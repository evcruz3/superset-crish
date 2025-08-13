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

import logging
from collections.abc import Iterator
from typing import Any, Callable

import yaml

from superset.daos.chart import ChartDAO
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.dict_import_export import EXPORT_VERSION

logger = logging.getLogger(__name__)


class MultiChartExportHandler:
    """
    Handles the export of Multi charts with their dependencies.
    """

    @staticmethod
    def get_deck_slices_ids(chart: Slice) -> list[int]:
        """
        Extract deck_slices IDs from a Multi chart's params.
        """
        try:
            params = json.loads(chart.params) if isinstance(chart.params, str) else chart.params
            return params.get("deck_slices", [])
        except (json.JSONDecodeError, TypeError):
            logger.warning(f"Failed to parse params for chart {chart.id}")
            return []
    
    @staticmethod
    def prepare_multi_chart_for_export(chart: Slice, deck_charts: list[Slice]) -> dict[str, Any]:
        """
        Prepare a Multi chart's params for export by converting deck_slices IDs to UUIDs.
        """
        try:
            params = json.loads(chart.params) if isinstance(chart.params, str) else chart.params
            
            # Create a mapping of chart IDs to UUIDs
            id_to_uuid = {deck_chart.id: str(deck_chart.uuid) for deck_chart in deck_charts}
            
            # Replace deck_slices IDs with UUIDs
            deck_slices = params.get("deck_slices", [])
            deck_slices_uuids = []
            
            for chart_id in deck_slices:
                if chart_id in id_to_uuid:
                    deck_slices_uuids.append(id_to_uuid[chart_id])
                else:
                    # Keep the ID if UUID not found (shouldn't happen in normal cases)
                    logger.warning(f"Could not find UUID for chart ID {chart_id}")
                    deck_slices_uuids.append(chart_id)
            
            # Return updated params with UUIDs
            params_copy = params.copy()
            params_copy["deck_slices"] = deck_slices_uuids
            return params_copy
            
        except Exception as ex:
            logger.error(f"Failed to prepare Multi chart for export: {ex}")
            return {}

    @staticmethod
    def export_with_dependencies(
        chart: Slice,
        export_chart_fn: Callable,
        export_dataset_fn: Callable,
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        """
        Export a Multi chart along with all its deck.gl dependencies.
        
        Args:
            chart: The Multi chart to export
            export_chart_fn: Function to export individual charts
            export_dataset_fn: Function to export datasets
        """
        # First, yield the main Multi chart
        yield from export_chart_fn(chart, export_related=False)
        
        # Get all deck_slices IDs
        deck_slice_ids = MultiChartExportHandler.get_deck_slices_ids(chart)
        
        if not deck_slice_ids:
            logger.info(f"No deck_slices found for Multi chart {chart.id}")
            # Still export the main chart's dataset if it exists
            if chart.table:
                yield from export_dataset_fn([chart.table.id])
            return
        
        # Fetch all referenced deck.gl charts
        referenced_charts = ChartDAO.find_by_ids(deck_slice_ids)
        found_ids = {chart.id for chart in referenced_charts}
        missing_ids = set(deck_slice_ids) - found_ids
        
        if missing_ids:
            logger.warning(
                f"Multi chart {chart.id} references missing deck.gl charts: {missing_ids}"
            )
        
        # Collect all unique datasets from all charts (including the Multi chart)
        dataset_ids = set()
        if chart.table:
            dataset_ids.add(chart.table.id)
        
        # Export each referenced deck.gl chart
        for deck_chart in referenced_charts:
            yield from export_chart_fn(deck_chart, export_related=False)
            if deck_chart.table:
                dataset_ids.add(deck_chart.table.id)
        
        # Export all unique datasets at the end
        if dataset_ids:
            yield from export_dataset_fn(list(dataset_ids))
        
        # Create a manifest file documenting the relationships
        manifest = {
            "version": EXPORT_VERSION,
            "type": "multi_chart_export",
            "multi_chart": {
                "uuid": str(chart.uuid),
                "name": chart.slice_name,
                "deck_slices": [
                    {
                        "id": deck_chart.id,
                        "uuid": str(deck_chart.uuid),
                        "name": deck_chart.slice_name,
                        "viz_type": deck_chart.viz_type,
                    }
                    for deck_chart in referenced_charts
                ],
                "missing_deck_slices": list(missing_ids) if missing_ids else [],
            },
        }
        
        yield (
            "multi_chart_manifest.yaml",
            lambda: yaml.safe_dump(manifest, sort_keys=False),
        )

    @staticmethod
    def is_multi_chart(chart: Slice) -> bool:
        """
        Check if a chart is a Multi chart based on its viz_type.
        """
        return chart.viz_type == "deck_multi"