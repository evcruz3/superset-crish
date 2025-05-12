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
from reportlab.lib.utils import ImageReader
import os
from PIL import Image as PILImage

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
    # Import here to avoid circular imports
    from superset import app
    
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    page_width = width - 100  # Margins on both sides
    
    # Start position - we'll adjust this based on logo placement
    y_start = height - 50
    y = y_start
    
    # Try to add the app icon from config
    try:
        app_icon = app.config.get('APP_ICON')
        if app_icon:
            # Handle both relative and absolute paths
            if app_icon.startswith('/static'):
                # Convert from URL path to file system path
                static_folder = app.static_folder
                icon_path = os.path.join(static_folder, app_icon.replace('/static/', ''))
            else:
                icon_path = app_icon
                
            if os.path.exists(icon_path):
                # Get original image dimensions to preserve aspect ratio
                img = PILImage.open(icon_path)
                img_width, img_height = img.size
                
                # Set max width and height while preserving aspect ratio
                max_img_height = 70  # Maximum height for the logo
                max_img_width = 200   # Maximum width for the logo
                
                # Calculate scaling factor to maintain aspect ratio
                width_ratio = max_img_width / img_width
                height_ratio = max_img_height / img_height
                scale_factor = min(width_ratio, height_ratio)
                
                # Calculate new dimensions
                new_width = img_width * scale_factor
                new_height = img_height * scale_factor
                
                # Calculate centered position
                img_x = (width - new_width) / 2
                img_y = y - new_height  # Position logo at the top
                
                # Draw the image centered
                p.drawImage(icon_path, img_x, img_y, width=new_width, height=new_height, preserveAspectRatio=True, mask='auto')
                
                # Adjust y position for title to be below the image
                y = img_y - 20  # Space between image and title
                
                # Add system title centered below the logo
                system_title = "Climate Risk Information System for Public Health"
                p.setFont("Helvetica-Bold", 18)
                title_width = p.stringWidth(system_title)
                title_x = (width - title_width) / 2
                p.drawString(title_x, y, system_title)
            else:
                # Just show the title without logo
                system_title = "Climate Risk Information System for Public Health"
                p.setFont("Helvetica-Bold", 18)
                title_width = p.stringWidth(system_title)
                title_x = (width - title_width) / 2
                p.drawString(title_x, y, system_title)
    except Exception as e:
        # If there's an error loading the image, just show the title
        system_title = "Climate Risk Information System for Public Health"
        p.setFont("Helvetica-Bold", 18)
        title_width = p.stringWidth(system_title)
        title_x = (width - title_width) / 2
        p.drawString(title_x, y, system_title)
    
    # Add some space after the title
    y -= 40
    
    # Helper function to split text by both actual newlines and escaped newlines
    def split_text(text):
        if not text:
            return []
        # First split by actual newlines
        lines = []
        for line in text.splitlines():
            # Then split by escaped newlines if they exist
            if '\\n' in line:
                lines.extend(line.split('\\n'))
            else:
                lines.append(line)
        return lines
    
    # Helper function to handle text that might be too long for one line
    def draw_wrapped_text(text, x, y, max_width):
        if not text:
            return y
            
        words = text.split()
        line = ""
        for word in words:
            test_line = f"{line} {word}".strip()
            test_width = p.stringWidth(test_line)
            
            if test_width <= max_width:
                line = test_line
            else:
                p.drawString(x, y, line)
                y -= 15
                line = word
                
        if line:
            p.drawString(x, y, line)
            y -= 15
            
        return y
    
    # Format date nicely
    def format_date(date_obj):
        if not date_obj:
            return ""
        from datetime import datetime
        if isinstance(date_obj, str):
            try:
                date_obj = datetime.fromisoformat(date_obj.replace('Z', '+00:00'))
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_obj, "%Y-%m-%dT%H:%M:%S.%f")
                except ValueError:
                    return date_obj  # Return as is if can't parse
        
        return date_obj.strftime("%B %d, %Y at %I:%M %p")
    
    # Title
    p.setFont("Helvetica-Bold", 16)
    title_y = draw_wrapped_text(bulletin.title, 50, y, page_width)
    y = title_y - 20  # Extra space after title
    
    # Metadata
    p.setFont("Helvetica-Oblique", 10)
    
    # Last modified date (if different from created date)
    if (hasattr(bulletin, 'changed_on') and bulletin.changed_on and 
        hasattr(bulletin, 'created_on') and bulletin.created_on and 
        bulletin.changed_on != bulletin.created_on):
        changed_date = format_date(bulletin.changed_on)
        p.drawString(50, y, f"Last updated: {changed_date}")
        y -= 15
    
    # Add some extra space after metadata
    y -= 10
    
    # Sections
    p.setFont("Helvetica-Bold", 12)
    sections = [
        ("Advisory", bulletin.advisory),
        ("Risks", bulletin.risks),
        ("Safety Tips", bulletin.safety_tips)
    ]
    
    for section_title, section_content in sections:
        if not section_content:
            continue
            
        # Section header
        p.drawString(50, y, section_title)
        y -= 20
        
        # Section content
        p.setFont("Helvetica", 12)
        content_lines = split_text(section_content)
        
        for line in content_lines:
            if y < 50:  # Check if we need a new page
                p.showPage()
                y = height - 50
                p.setFont("Helvetica", 12)
                
            y = draw_wrapped_text(line, 70, y, page_width - 20)
            # No need to subtract y here as draw_wrapped_text already does it
            
        # Extra space after section
        y -= 15
        p.setFont("Helvetica-Bold", 12)
    
    # Hashtags if available
    if bulletin.hashtags:
        if y < 50:  # Check if we need a new page
            p.showPage()
            y = height - 50
            
        p.drawString(50, y, "Hashtags:")
        y -= 20
        
        p.setFont("Helvetica", 12)
        hashtags_text = bulletin.hashtags.replace(',', ' #')
        if not hashtags_text.startswith('#'):
            hashtags_text = f"#{hashtags_text}"
            
        y = draw_wrapped_text(hashtags_text, 70, y, page_width - 20)
    
    # Add ID at the bottom of the last page
    p.setFont("Helvetica", 8)
    p.drawString(50, 30, f"Bulletin ID: {bulletin.id}")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer
