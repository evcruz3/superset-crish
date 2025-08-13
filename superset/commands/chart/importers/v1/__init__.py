# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from typing import Any

from marshmallow import Schema
from sqlalchemy.orm import Session  # noqa: F401

from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.chart.exceptions import ChartImportError
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.chart.importers.v1.multi_chart_utils import MultiChartImportUtils
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.importers.v1 import ImportModelsCommand
from superset.commands.utils import update_chart_config_dataset
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema


class ImportChartsCommand(ImportModelsCommand):
    """Import charts"""

    dao = ChartDAO
    model_name = "chart"
    prefix = "charts/"
    # Don't instantiate schemas at class level - use property instead
    _schemas = None
    import_error = ChartImportError
    
    @property
    def schemas(self) -> dict[str, Schema]:
        """Dynamically create schemas to ensure we get the latest version."""
        if self._schemas is None:
            self._schemas = {
                "charts/": ImportV1ChartSchema(),
                "datasets/": ImportV1DatasetSchema(),
                "databases/": ImportV1DatabaseSchema(),
            }
        return self._schemas
    
    def __init__(self, contents: dict[str, str], *args: Any, **kwargs: Any):
        super().__init__(contents, *args, **kwargs)
        # Force recreation of schemas
        self._schemas = None

    @staticmethod
    def _import(configs: dict[str, Any], overwrite: bool = False) -> None:
        # discover datasets associated with charts
        dataset_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                dataset_uuids.add(config["dataset_uuid"])

        # discover databases associated with datasets
        database_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("datasets/") and config["uuid"] in dataset_uuids:
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        datasets: dict[str, SqlaTable] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(config, overwrite=False)
                datasets[str(dataset.uuid)] = dataset

        # Track imported charts for Multi chart reference updates
        chart_uuid_to_id: dict[str, int] = {}
        multi_charts_to_update: list[tuple[str, dict[str, Any]]] = []
        
        # Get the correct import order (regular charts before Multi charts)
        ordered_files = MultiChartImportUtils.get_import_order(configs)
        
        # Import charts in the correct order
        for file_name in ordered_files:
            if file_name.startswith("charts/"):
                config = configs[file_name]
                
                if config["dataset_uuid"] not in datasets:
                    continue
                    
                # Ignore obsolete filter-box charts.
                if config["viz_type"] == "filter_box":
                    continue

                # update datasource id, type, and name
                dataset = datasets[config["dataset_uuid"]]
                dataset_dict = {
                    "datasource_id": dataset.id,
                    "datasource_type": "table",
                    "datasource_name": dataset.table_name,
                }
                config = update_chart_config_dataset(config, dataset_dict)
                
                # Import the chart
                chart = import_chart(config, overwrite=overwrite)
                chart_uuid_to_id[str(chart.uuid)] = chart.id
                
                # If this is a Multi chart, save it for later reference updates
                if MultiChartImportUtils.is_multi_chart(config):
                    multi_charts_to_update.append((str(chart.uuid), config))
        
        # Update Multi chart deck_slices references with new IDs
        for multi_uuid, multi_config in multi_charts_to_update:
            # Update the chart in the database with correct deck_slices references
            from superset import db
            from superset.models.slice import Slice
            from superset.utils import json
            
            multi_chart = db.session.query(Slice).filter_by(uuid=multi_uuid).first()
            if multi_chart:
                # Update the params with correct deck_slices IDs
                params = json.loads(multi_chart.params) if isinstance(multi_chart.params, str) else multi_chart.params
                old_deck_slices = params.get("deck_slices", [])
                new_deck_slices = []
                
                for ref in old_deck_slices:
                    # Try to map UUID to new ID
                    if isinstance(ref, str) and ref in chart_uuid_to_id:
                        new_deck_slices.append(chart_uuid_to_id[ref])
                    elif isinstance(ref, int):
                        # Keep the ID as is (for backward compatibility)
                        new_deck_slices.append(ref)
                
                params["deck_slices"] = new_deck_slices
                multi_chart.params = json.dumps(params)
                db.session.commit()
