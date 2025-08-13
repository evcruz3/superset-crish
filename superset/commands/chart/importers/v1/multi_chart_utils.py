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
from typing import Any

from superset import db
from superset.models.slice import Slice
from superset.utils import json

logger = logging.getLogger(__name__)


class MultiChartImportUtils:
    """
    Utilities for handling Multi chart imports with dependencies.
    """

    @staticmethod
    def is_multi_chart(config: dict[str, Any]) -> bool:
        """
        Check if a chart configuration represents a Multi chart.
        """
        return config.get("viz_type") == "deck_multi"

    @staticmethod
    def get_deck_slices_from_config(config: dict[str, Any]) -> list[int]:
        """
        Extract deck_slices IDs from a chart configuration.
        """
        try:
            params = config.get("params", {})
            if isinstance(params, str):
                params = json.loads(params)
            return params.get("deck_slices", [])
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse params from config")
            return []

    @staticmethod
    def update_deck_slices_references(
        multi_chart_config: dict[str, Any],
        uuid_to_id_map: dict[str, int],
    ) -> dict[str, Any]:
        """
        Update deck_slices references in a Multi chart config after import.
        
        Args:
            multi_chart_config: The Multi chart configuration
            uuid_to_id_map: Mapping from chart UUIDs to their new IDs after import
        
        Returns:
            Updated configuration with new deck_slices IDs
        """
        try:
            params = multi_chart_config.get("params", {})
            if isinstance(params, str):
                params = json.loads(params)
            
            # Get the current deck_slices (may contain old IDs or UUIDs)
            old_deck_slices = params.get("deck_slices", [])
            new_deck_slices = []
            
            for ref in old_deck_slices:
                # Check if ref is a UUID string that we can map
                if isinstance(ref, str) and ref in uuid_to_id_map:
                    new_deck_slices.append(uuid_to_id_map[ref])
                elif isinstance(ref, int):
                    # Try to find the chart by old ID and get its new ID
                    # This is a fallback for when IDs are used instead of UUIDs
                    logger.warning(
                        f"deck_slices contains ID {ref} instead of UUID. "
                        "This may cause issues during import."
                    )
                    new_deck_slices.append(ref)
            
            # Update the params with new deck_slices
            params["deck_slices"] = new_deck_slices
            multi_chart_config["params"] = json.dumps(params)
            
            return multi_chart_config
            
        except Exception as ex:
            logger.error(f"Failed to update deck_slices references: {ex}")
            return multi_chart_config

    @staticmethod
    def validate_deck_slices_exist(
        deck_slice_refs: list[int | str],
    ) -> tuple[list[int], list[int | str]]:
        """
        Validate that deck_slices referenced by a Multi chart exist.
        
        Args:
            deck_slice_refs: List of chart IDs or UUIDs to validate
            
        Returns:
            Tuple of (existing_ids, missing_refs)
        """
        if not deck_slice_refs:
            return [], []
        
        # Separate IDs and UUIDs
        ids = [ref for ref in deck_slice_refs if isinstance(ref, int)]
        uuids = [ref for ref in deck_slice_refs if isinstance(ref, str)]
        
        existing_charts = []
        
        # Query by IDs if any
        if ids:
            existing_charts.extend(
                db.session.query(Slice).filter(Slice.id.in_(ids)).all()
            )
        
        # Query by UUIDs if any
        if uuids:
            existing_charts.extend(
                db.session.query(Slice).filter(Slice.uuid.in_(uuids)).all()
            )
        
        # Get existing IDs or UUIDs
        existing_ids = [chart.id for chart in existing_charts]
        existing_refs = ids + uuids
        found_refs = []
        
        for chart in existing_charts:
            if chart.id in ids:
                found_refs.append(chart.id)
            elif str(chart.uuid) in uuids:
                found_refs.append(str(chart.uuid))
        
        missing_refs = list(set(existing_refs) - set(found_refs))
        
        return existing_ids, missing_refs

    @staticmethod
    def find_multi_chart_dependencies(
        configs: dict[str, Any],
    ) -> dict[str, list[str]]:
        """
        Find all Multi charts and their dependencies in the import configs.
        
        Args:
            configs: Dictionary of file paths to configurations
            
        Returns:
            Dictionary mapping Multi chart UUIDs to their deck_slices UUIDs
        """
        dependencies = {}
        
        # First pass: collect all chart UUIDs and their deck_slices
        chart_uuid_to_deck_slices = {}
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and MultiChartImportUtils.is_multi_chart(config):
                chart_uuid = config.get("uuid")
                if chart_uuid:
                    # For import, deck_slices should contain UUIDs of referenced charts
                    deck_slices = MultiChartImportUtils.get_deck_slices_from_config(config)
                    chart_uuid_to_deck_slices[chart_uuid] = deck_slices
        
        # Second pass: validate and map UUIDs
        for multi_uuid, deck_slice_refs in chart_uuid_to_deck_slices.items():
            deck_slice_uuids = []
            for ref in deck_slice_refs:
                # During export, we should have stored UUIDs
                # But handle both cases for backward compatibility
                if isinstance(ref, str):
                    deck_slice_uuids.append(ref)
                else:
                    # If it's an ID, try to find the corresponding UUID in configs
                    for fname, cfg in configs.items():
                        if fname.startswith("charts/") and cfg.get("id") == ref:
                            uuid = cfg.get("uuid")
                            if uuid:
                                deck_slice_uuids.append(uuid)
                                break
            
            dependencies[multi_uuid] = deck_slice_uuids
        
        return dependencies

    @staticmethod
    def get_import_order(configs: dict[str, Any]) -> list[str]:
        """
        Determine the correct import order for charts, ensuring deck.gl charts
        are imported before Multi charts that reference them.
        
        Args:
            configs: Dictionary of file paths to configurations
            
        Returns:
            Ordered list of file paths to import
        """
        dependencies = MultiChartImportUtils.find_multi_chart_dependencies(configs)
        
        # Separate charts into regular charts and multi charts
        regular_charts = []
        multi_charts = []
        
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                if MultiChartImportUtils.is_multi_chart(config):
                    multi_charts.append(file_name)
                else:
                    regular_charts.append(file_name)
        
        # Import order: databases -> datasets -> regular charts -> multi charts
        ordered_files = []
        
        # Add databases first
        ordered_files.extend([f for f in configs.keys() if f.startswith("databases/")])
        
        # Add datasets
        ordered_files.extend([f for f in configs.keys() if f.startswith("datasets/")])
        
        # Add regular charts
        ordered_files.extend(regular_charts)
        
        # Add multi charts last
        ordered_files.extend(multi_charts)
        
        return ordered_files