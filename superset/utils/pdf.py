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
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from superset.commands.report.exceptions import ReportSchedulePdfFailedError

logger = logging.getLogger(__name__)
try:
    from PIL import Image
except ModuleNotFoundError:
    logger.info("No PIL installation found")


def build_pdf_from_screenshots(snapshots: list[bytes]) -> bytes:
    images = []

    for snap in snapshots:
        img = Image.open(BytesIO(snap))
        if img.mode == "RGBA":
            img = img.convert("RGB")
        images.append(img)
    logger.info("building pdf")
    try:
        new_pdf = BytesIO()
        images[0].save(new_pdf, "PDF", save_all=True, append_images=images[1:])
        new_pdf.seek(0)
    except Exception as ex:
        raise ReportSchedulePdfFailedError(
            f"Failed converting screenshots to pdf {str(ex)}"
        ) from ex

    return new_pdf.read()


def generate_bulletin_pdf(bulletin):
    """
    Generates a PDF file in memory from a Bulletin object.
    Returns a BytesIO object containing the PDF data.
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 50
    
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y, bulletin.title)
    y -= 30
    
    p.setFont("Helvetica", 12)
    if bulletin.advisory:
        p.drawString(50, y, "Advisory:")
        y -= 20
        for line in bulletin.advisory.splitlines():
            p.drawString(70, y, line)
            y -= 15
        y -= 10
    if bulletin.risks:
        p.drawString(50, y, "Risks:")
        y -= 20
        for line in bulletin.risks.splitlines():
            p.drawString(70, y, line)
            y -= 15
        y -= 10
    if bulletin.safety_tips:
        p.drawString(50, y, "Safety Tips:")
        y -= 20
        for line in bulletin.safety_tips.splitlines():
            p.drawString(70, y, line)
            y -= 15
        y -= 10
    if bulletin.hashtags:
        p.drawString(50, y, f"Hashtags: {bulletin.hashtags}")
        y -= 20
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer
