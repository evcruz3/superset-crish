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
from reportlab.lib import colors
from reportlab.lib.units import inch

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
    
    # Define margins
    margin_left = 0.75 * inch
    margin_right = 0.75 * inch
    margin_top = 0.5 * inch
    margin_bottom = 0.5 * inch
    
    content_width = width - margin_left - margin_right
    
    # Start position
    y = height - margin_top
    
    # --- App Icon and System Title ---
    try:
        app_icon = app.config.get('APP_ICON')
        if app_icon:
            if app_icon.startswith('/static'):
                static_folder = app.static_folder
                icon_path = os.path.join(static_folder, app_icon.replace('/static/', ''))
            else:
                icon_path = app_icon
                
            if os.path.exists(icon_path):
                img = PILImage.open(icon_path)
                img_width, img_height = img.size
                max_img_height = 0.8 * inch
                max_img_width = 2.5 * inch
                
                width_ratio = max_img_width / img_width if img_width > 0 else 1
                height_ratio = max_img_height / img_height if img_height > 0 else 1
                scale_factor = min(width_ratio, height_ratio, 1) # Don't scale up
                
                new_width = img_width * scale_factor
                new_height = img_height * scale_factor
                
                img_x = (width - new_width) / 2
                img_y_top = y - new_height 
                p.drawImage(icon_path, img_x, img_y_top, width=new_width, height=new_height, preserveAspectRatio=True, mask='auto')
                y = img_y_top - (0.1 * inch) 
        
        system_title_text = app.config.get("APP_NAME", "Superset") # Use APP_NAME, fallback to Superset
        p.setFont("Helvetica-Bold", 16)
        title_width = p.stringWidth(system_title_text, "Helvetica-Bold", 16)
        title_x = (width - title_width) / 2
        p.drawString(title_x, y, system_title_text)
        y -= (0.2 * inch) + 16 # Space after system title (16 is font size)
    except Exception as e:
        logger.error(f"Error adding logo/system title to PDF: {e}")
        # Fallback if image/title fails
        y -= 0.5 * inch 


    y -= 0.2 * inch # Initial space before bulletin title

    # --- Helper Functions ---
    def split_text_to_lines(text_input, max_width_for_wrap, font_name, font_size_for_wrap):
        # Splits text into lines considering max_width, handles existing newlines.
        output_lines = []
        if not text_input:
            return output_lines
        
        # Split by explicit newlines first
        paragraphs = []
        for para_part in text_input.splitlines():
            paragraphs.extend(para_part.split('\\n'))

        for paragraph_text in paragraphs:
            words = paragraph_text.split()
            current_line = ""
            for word in words:
                test_line = f"{current_line} {word}".strip()
                if p.stringWidth(test_line, font_name, font_size_for_wrap) <= max_width_for_wrap:
                    current_line = test_line
                else:
                    if current_line: # Avoid adding empty lines if a word is too long itself
                        output_lines.append(current_line)
                    current_line = word # Start new line with the current word
            if current_line: # Add the last line
                output_lines.append(current_line)
        return output_lines

    line_height_normal = 14 # For 12pt font
    line_height_small = 10 # for 8pt font
    section_padding = 0.1 * inch
    
    # Function to draw a full section with background and border
    def draw_section(current_y, title, content, bg_color_hex, border_color_hex, text_font="Helvetica", text_size=11, title_font="Helvetica-Bold", title_size=12):
        nonlocal y # Allow modification of y from outer scope
        y = current_y
        leading_text = text_size * 1.2 # Line height for content

        # --- Draw Section Title ---
        p.setFont(title_font, title_size)
        title_height = title_size * 1.2
        
        # Calculate actual content lines for height estimation
        content_lines = split_text_to_lines(content, content_width - (0.2 * inch) - (0.1*inch), text_font, text_size) # content_width - border - padding
        content_block_height = len(content_lines) * leading_text + (section_padding if content_lines else 0)
        
        total_section_height = title_height + section_padding + content_block_height + section_padding

        # --- Page Break Check before drawing section background ---
        if y - total_section_height < margin_bottom:
            p.showPage()
            p.setFont(title_font, title_size) # Reset font after page break
            y = height - margin_top

        # --- Draw Background and Border ---
        bg_rect_y = y - title_height - section_padding - content_block_height
        p.setFillColor(colors.HexColor(bg_color_hex))
        p.rect(margin_left, bg_rect_y, content_width, content_block_height + title_height + section_padding, stroke=0, fill=1)
        
        p.setStrokeColor(colors.HexColor(border_color_hex))
        p.setLineWidth(3) # 3 points thick border
        p.line(margin_left, bg_rect_y, margin_left, y - section_padding) # Vertical border line for the whole section block
        
        # --- Draw Title Text ---
        p.setFillColor(colors.black) # Reset text color
        p.drawString(margin_left + 0.1 * inch, y - title_size, title)
        y -= (title_height + section_padding)

        # --- Draw Content Text ---
        p.setFont(text_font, text_size)
        for line_text in content_lines:
            if y - leading_text < margin_bottom: # Check for page break before drawing each line of content
                p.showPage()
                p.setFont(text_font, text_size) # Reset font
                y = height - margin_top
                # Redraw background and border for continued section on new page
                p.setFillColor(colors.HexColor(bg_color_hex))
                p.rect(margin_left, margin_bottom, content_width, y - margin_bottom - section_padding, stroke=0, fill=1) # Approx height
                p.setStrokeColor(colors.HexColor(border_color_hex))
                p.setLineWidth(3)
                p.line(margin_left, margin_bottom, margin_left, y- section_padding)


            p.drawString(margin_left + 0.2 * inch, y - text_size, line_text) # Indent content slightly more
            y -= leading_text
        
        y -= section_padding # Space after section content
        return y

    # --- Bulletin Title ---
    p.setFont("Helvetica-Bold", 18)
    bulletin_title_lines = split_text_to_lines(bulletin.title, content_width, "Helvetica-Bold", 18)
    for line in bulletin_title_lines:
        if y - 18 < margin_bottom: # 18 is font size
            p.showPage()
            p.setFont("Helvetica-Bold", 18)
            y = height - margin_top
        line_width = p.stringWidth(line, "Helvetica-Bold", 18)
        p.drawString(margin_left + (content_width - line_width)/2, y - 18, line) # Centered
        y -= 22 # Line height for 18pt bold
    y -= 0.2 * inch # Space after bulletin title

    # --- Metadata ---
    p.setFont("Helvetica-Oblique", 9)
    meta_line_height = 11
    if hasattr(bulletin, 'created_on') and bulletin.created_on:
        created_date_str = bulletin.created_on.strftime("%B %d, %Y at %I:%M %p %Z") if bulletin.created_on else "N/A"
        if y - meta_line_height < margin_bottom: p.showPage(); y = height - margin_top; p.setFont("Helvetica-Oblique", 9)
        p.drawString(margin_left, y - 9, f"Published: {created_date_str}")
        y -= meta_line_height
    
    if (hasattr(bulletin, 'changed_on') and bulletin.changed_on and 
        hasattr(bulletin, 'created_on') and bulletin.created_on and 
        bulletin.changed_on.strftime("%Y-%m-%d %H:%M") != bulletin.created_on.strftime("%Y-%m-%d %H:%M")):
        changed_date_str = bulletin.changed_on.strftime("%B %d, %Y at %I:%M %p %Z") if bulletin.changed_on else "N/A"
        if y - meta_line_height < margin_bottom: p.showPage(); y = height - margin_top; p.setFont("Helvetica-Oblique", 9)
        p.drawString(margin_left, y - 9, f"Last Updated: {changed_date_str}")
        y -= meta_line_height
    y -= 0.2 * inch # Space after metadata
    
    # --- Define Section Styles ---
    # Style colors from disseminate_form.html
    style_colors = {
        "Advisory":    {"bg": "#e6f7ff", "border": "#91d5ff"},
        "Risks":       {"bg": "#fffbe6", "border": "#ffe58f"},
        "Safety Tips": {"bg": "#f6ffed", "border": "#b7eb8f"},
        "Hashtags":    {"bg": "#f0f0f0", "border": "#bfbfbf"} # General section style for hashtags
    }

    # --- Sections ---
    sections_data = [
        ("Advisory", bulletin.advisory),
        ("Risks", bulletin.risks),
        ("Safety Tips", bulletin.safety_tips)
    ]

    for title, content_text in sections_data:
        if content_text and content_text.strip():
            section_style = style_colors.get(title, {"bg": "#f0f0f0", "border": "#cccccc"}) # Fallback style
            y = draw_section(y, title, content_text, section_style["bg"], section_style["border"])
            y -= 0.1*inch # spacing between sections
    
    # --- Hashtags ---
    if bulletin.hashtags and bulletin.hashtags.strip():
        title = "Hashtags"
        # Prepare hashtag string: ensure starts with #, space separated
        tags = [f"#{tag.strip()}" for tag in bulletin.hashtags.split(',') if tag.strip()]
        content_text = " ".join(tags)
        
        section_style = style_colors.get(title, {"bg": "#f0f0f0", "border": "#cccccc"})
        y = draw_section(y, title, content_text, section_style["bg"], section_style["border"], text_font="Helvetica-Oblique", text_size=10)
        y -= 0.1*inch

    # --- Footer with Bulletin ID ---
    # Ensure footer is at the bottom
    if y < margin_bottom + line_height_small + (0.1*inch) : # If not enough space for ID line
         p.showPage() # This might create an almost empty page if ID is the only thing left
         # Consider drawing footer on every page if this behavior is not desired.
    
    p.setFont("Helvetica", 8)
    id_text = f"Bulletin ID: {bulletin.id}"
    p.drawString(margin_left, margin_bottom + (0.05*inch), id_text) # Draw at fixed bottom position
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer
