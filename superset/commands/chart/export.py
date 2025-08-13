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
# isort:skip_file

import logging
from collections.abc import Iterator
from typing import Callable

import yaml

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.daos.chart import ChartDAO
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.export.models import ExportModelsCommand
from superset.commands.chart.exporters.multi_chart_handler import MultiChartExportHandler
from superset.models.slice import Slice
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils import json

logger = logging.getLogger(__name__)


# keys present in the standard export that are not needed
REMOVE_KEYS = ["datasource_type", "datasource_name", "url_params"]


class ExportChartsCommand(ExportModelsCommand):
    dao = ChartDAO
    not_found = ChartNotFoundError

    @staticmethod
    def _file_name(model: Slice) -> str:
        file_name = get_filename(model.slice_name, model.id)
        return f"charts/{file_name}.yaml"

    @staticmethod
    def _file_content(model: Slice) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        payload = {
            key: value for key, value in payload.items() if key not in REMOVE_KEYS
        }

        if payload.get("params"):
            try:
                params = json.loads(payload["params"])
                
                # If this is a Multi chart, convert deck_slices IDs to UUIDs
                if MultiChartExportHandler.is_multi_chart(model):
                    deck_slice_ids = params.get("deck_slices", [])
                    if deck_slice_ids:
                        # Fetch the referenced charts
                        referenced_charts = ChartDAO.find_by_ids(deck_slice_ids)
                        # Update params with UUIDs
                        params = MultiChartExportHandler.prepare_multi_chart_for_export(
                            model, referenced_charts
                        )
                
                payload["params"] = params
            except json.JSONDecodeError:
                logger.info("Unable to decode `params` field: %s", payload["params"])

        payload["version"] = EXPORT_VERSION
        if model.table:
            payload["dataset_uuid"] = str(model.table.uuid)

        file_content = yaml.safe_dump(payload, sort_keys=False)
        return file_content

    @staticmethod
    def _export(
        model: Slice, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        # Check if this is a Multi chart
        if MultiChartExportHandler.is_multi_chart(model) and export_related:
            # Use the MultiChartExportHandler for Multi charts
            yield from MultiChartExportHandler.export_with_dependencies(
                model,
                export_chart_fn=ExportChartsCommand._export,
                export_dataset_fn=lambda ids: ExportDatasetsCommand(ids).run(),
            )
        else:
            # Standard export for other chart types
            yield (
                ExportChartsCommand._file_name(model),
                lambda: ExportChartsCommand._file_content(model),
            )

            if model.table and export_related:
                yield from ExportDatasetsCommand([model.table.id]).run()
