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
import boto3
from botocore.exceptions import ClientError

from superset.commands.report.exceptions import ReportSchedulePdfFailedError

logger = logging.getLogger(__name__)
try:
    from PIL import Image
except ModuleNotFoundError:
    logger.info("No PIL installation found")


class BulletinCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        self.bulletin_id_str = kwargs.pop('bulletin_id_str', "N/A")
        super().__init__(*args, **kwargs)
        # Page dimensions and margins are often set on the canvas instance or retrieved from pagesize
        self._page_width, self._page_height = self._pagesize
        
        # Define margins (consistent with generate_bulletin_pdf)
        # These are used for positioning the footer elements.
        self.margin_left = 0.75 * inch
        self.margin_right = 0.75 * inch
        self.margin_bottom_abs = 0.5 * inch # Absolute margin from paper edge for footer positioning

    def _draw_page_footer(self):
        self.saveState()
        self.setFont("Helvetica", 8)
        
        # Footer Y position (e.g., 0.25 inch from the bottom edge of the paper)
        footer_y_position = self.margin_bottom_abs * 0.5 

        # Bulletin ID (bottom-left)
        id_text = f"Bulletin ID: {self.bulletin_id_str}"
        self.drawString(self.margin_left, footer_y_position, id_text)

        # Page number (bottom-right)
        page_num_text = f"Page {self.getPageNumber()}"
        text_width = self.stringWidth(page_num_text, "Helvetica", 8)
        self.drawRightString(self._page_width - self.margin_right, footer_y_position, page_num_text)
        
        self.restoreState()

    def showPage(self):
        self._draw_page_footer() # Draw footer on current page before finishing it
        super().showPage()

    def save(self):
        self._draw_page_footer() # Draw footer on the last page before saving
        super().save()


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
    
    logger.info(f"Generating PDF for bulletin ID: {getattr(bulletin, 'id', 'N/A')}, Title: {getattr(bulletin, 'title', 'N/A')}")

    # --- S3/MinIO Client Initialization ---
    s3_client = None
    s3_bucket_name = app.config.get('S3_BUCKET')
    s3_endpoint_url = app.config.get('S3_ENDPOINT_URL')
    s3_access_key = app.config.get('S3_ACCESS_KEY')
    s3_secret_key = app.config.get('S3_SECRET_KEY')
    # boto3 might also need region_name, use_ssl, verify, and addressing_style (e.g., 'path' for MinIO)
    # For MinIO, endpoint_url is crucial.
    # s3_addressing_style = app.config.get('S3_ADDRESSING_STYLE', 'path') # common for MinIO

    if s3_bucket_name and s3_endpoint_url and s3_access_key and s3_secret_key:
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                endpoint_url=s3_endpoint_url,
                # region_name can be omitted if not relevant for MinIO setup or if endpoint_url includes it implicitly
                # config=boto3.session.Config(signature_version='s3v4', s3={'addressing_style': s3_addressing_style}) # More specific config if needed
            )
            logger.info("S3 client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}", exc_info=True)
            s3_client = None # Ensure client is None if init fails
    else:
        logger.warning("S3 client configuration missing. Cannot fetch images from S3/MinIO.")


    buffer = BytesIO()
    # Use the custom BulletinCanvas
    p = BulletinCanvas(buffer, pagesize=letter, bulletin_id_str=str(getattr(bulletin, 'id', 'N/A')))
    width, height = letter # page dimensions remain letter size
    
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
        y -= 16 # Adjust y for the height of the title (font size)

        # Add a small gap between title and subheader
        y -= (0.05 * inch)

        # Subheader: Climate Risk Information System for Public Health
        subheader_text = "Climate Risk Information System for Public Health"
        subheader_font_size = 12 
        p.setFont("Helvetica-Bold", subheader_font_size) # Consistent with login page (bold)
        subheader_text_width = p.stringWidth(subheader_text, "Helvetica-Bold", subheader_font_size)
        subheader_x = (width - subheader_text_width) / 2
        p.drawString(subheader_x, y, subheader_text)
        
        # Adjust y for the height of the subheader
        y -= subheader_font_size 
        # Space after the subheader (and title block)
        y -= (0.2 * inch) 
    except Exception as e:
        logger.error(f"Error adding logo/system title/subheader to PDF: {e}")
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
        created_date_str = bulletin.created_on.strftime("%d %B, %Y at %I:%M %p %Z") if bulletin.created_on else "N/A"
        if y - meta_line_height < margin_bottom: p.showPage(); y = height - margin_top; p.setFont("Helvetica-Oblique", 9)
        p.drawString(margin_left, y - 9, f"Published: {created_date_str}")
        y -= meta_line_height
    
    if (hasattr(bulletin, 'changed_on') and bulletin.changed_on and 
        hasattr(bulletin, 'created_on') and bulletin.created_on and 
        bulletin.changed_on.strftime("%Y-%m-%d %H:%M") != bulletin.created_on.strftime("%Y-%m-%d %H:%M")):
        changed_date_str = bulletin.changed_on.strftime("%d %B, %Y at %I:%M %p %Z") if bulletin.changed_on else "N/A"
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
    
    # --- Attached Images ---
    if hasattr(bulletin, 'image_attachments') and bulletin.image_attachments and s3_client: # Check for s3_client
        logger.info(f"Found {len(bulletin.image_attachments)} image attachment objects for bulletin ID: {bulletin.id}.")
        
        attachments_to_process = bulletin.image_attachments # This is now a list of BulletinImageAttachment objects

        if not attachments_to_process:
             logger.info(f"No image attachment objects to process for bulletin ID: {bulletin.id}")
        else:
            logger.info(f"Processing {len(attachments_to_process)} image attachment objects for bulletin ID: {bulletin.id}")
            for attachment_idx, attachment in enumerate(attachments_to_process):
                img_data = None
                object_key = attachment.s3_key
                image_caption = attachment.caption # Get caption from the attachment object
                
                filename_for_fallback_caption = os.path.basename(object_key) # Fallback if caption is empty

                try:
                    logger.info(f"Attempting to fetch S3 object: Bucket='{s3_bucket_name}', Key='{object_key}' for attachment ID {attachment.id}")
                    s3_response = s3_client.get_object(Bucket=s3_bucket_name, Key=object_key)
                    img_data = s3_response['Body'].read()
                    logger.info(f"Successfully fetched S3 object '{object_key}'. Data length: {len(img_data)}")

                    if not img_data:
                        logger.warning(f"S3 object '{object_key}' has no data.")
                        continue
                        
                    logger.info(f"Processing S3 attachment #{attachment_idx} (ID: {attachment.id}): Key: {object_key}, Caption: '{image_caption}', Fallback Filename: {filename_for_fallback_caption}")

                    supported_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp')
                    if not object_key.lower().endswith(supported_extensions):
                        logger.warning(f"Skipping S3 object with unsupported extension: {object_key} (Attachment ID: {attachment.id}, Attachment #{attachment_idx})")
                        continue
                    
                    # Initial BytesIO from attachment data
                    img_bytes_io_source = BytesIO(img_data)
                    pil_img = PILImage.open(img_bytes_io_source)
                    logger.info(f"S3 Attachment #{attachment_idx}, Key: {object_key}: Opened with PIL. Original mode: {pil_img.mode}, Size: {pil_img.size}")
                    
                    # Prepare a BytesIO buffer that will hold the final image data for ReportLab
                    final_img_data_for_reportlab_io = BytesIO()

                    if pil_img.mode == 'RGBA':
                        # Create an RGB image with a white background
                        background = PILImage.new('RGB', pil_img.size, (255, 255, 255))
                        # Paste the RGBA image onto the white background using the alpha channel as a mask
                        alpha_channel = pil_img.split()[3] if len(pil_img.split()) == 4 else None
                        if alpha_channel:
                            background.paste(pil_img, (0, 0), alpha_channel)
                        else: # Fallback if no alpha channel (e.g. misidentified RGBA)
                            background.paste(pil_img, (0,0))
                        pil_img = background # pil_img is now the RGB image
                        pil_img.save(final_img_data_for_reportlab_io, format='PNG')
                        logger.info(f"S3 Attachment #{attachment_idx}, Key: {object_key}: Converted RGBA to RGB and saved to PNG buffer.")
                    elif pil_img.mode != 'RGB':
                        pil_img = pil_img.convert('RGB') # pil_img is now the RGB image
                        pil_img.save(final_img_data_for_reportlab_io, format='PNG')
                        logger.info(f"S3 Attachment #{attachment_idx}, Key: {object_key}: Converted from mode {pil_img.mode} to RGB and saved to PNG buffer.")
                    else: # Already RGB
                        pil_img.save(final_img_data_for_reportlab_io, format='PNG') # Save to ensure it's in a common format like PNG
                        logger.info(f"S3 Attachment #{attachment_idx}, Key: {object_key}: Already RGB. Saved to PNG buffer.")

                    final_img_data_for_reportlab_io.seek(0)
                    # Now pil_img is an RGB PIL.Image object, and final_img_data_for_reportlab_io contains its data as PNG.
                    img_original_width, img_original_height = pil_img.size

                    if img_original_width == 0 or img_original_height == 0:
                        logger.warning(f"Skipping S3 attachment with zero dimensions after processing: {object_key} (Attachment ID: {attachment.id}, Attachment #{attachment_idx})")
                        continue
                    
                    # The logger line for Original WxH etc. was removed in a previous step, let's ensure it's correct
                    logger.info(f"S3 Attachment #{attachment_idx} (ID: {attachment.id}), Key: {object_key}: Original WxH: {img_original_width}x{img_original_height}, Scaled WxH: {img_original_width}x{img_original_height}, Scale Factor: {1.0}")

                    max_render_width = content_width
                    max_render_height = height * 0.5 # Image takes max 50% of page height
                    
                    scale_factor = 1.0
                    if img_original_width > 0 and img_original_height > 0 : # Avoid division by zero
                        width_ratio = max_render_width / img_original_width
                        height_ratio = max_render_height / img_original_height
                        scale_factor = min(width_ratio, height_ratio, 1.0) # Don't scale up if image is small
                    
                    scaled_width = img_original_width * scale_factor
                    scaled_height = img_original_height * scale_factor
                    
                    caption_height = 0
                    current_caption_text = image_caption if image_caption and image_caption.strip() else filename_for_fallback_caption

                    if current_caption_text:
                        caption_font_size = 8
                        caption_leading = caption_font_size * 1.2
                        caption_height = caption_leading + (0.05 * inch) # text + small padding below
                    
                    total_item_height_needed = scaled_height + caption_height + (0.15 * inch) # image + caption + padding after image item

                    if y - total_item_height_needed < margin_bottom:
                        p.showPage()
                        y = height - margin_top
                    
                    img_x_centered = margin_left + (content_width - scaled_width) / 2
                    
                    reportlab_img = ImageReader(final_img_data_for_reportlab_io)

                    logger.info(f"S3 Attachment #{attachment_idx}, Key: {object_key}: Attempting to drawImage at y={y}, scaled_height={scaled_height}")
                    p.drawImage(reportlab_img, img_x_centered, y - scaled_height, 
                                width=scaled_width, height=scaled_height, 
                                preserveAspectRatio=True, mask='auto')
                    y -= scaled_height
                    
                    if current_caption_text:
                        p.setFont("Helvetica-Oblique", caption_font_size)
                        # Small space between image and caption
                        y -= (caption_font_size * 0.2) 
                        caption_y_pos = y - caption_font_size 
                        
                        # Ensure caption itself does not cause an unnecessary page break if image just fit
                        if caption_y_pos < margin_bottom :
                            p.showPage()
                            y = height - margin_top
                            # re-calculate y pos for caption on new page
                            y -= (caption_font_size * 0.2)
                            caption_y_pos = y - caption_font_size

                        p.drawCentredString(margin_left + content_width / 2, caption_y_pos, current_caption_text)
                        y = caption_y_pos - (0.05 * inch) # Space after caption text

                    y -= 0.15 * inch # Padding after the entire image item (image + caption)
                    
                except ClientError as e:
                    logger.error(f"S3 ClientError processing object key '{object_key}' (Attachment ID: {attachment.id}) for PDF: {e}", exc_info=True)
                    error_message_text = f"[Error loading image: {filename_for_fallback_caption}]"
                    error_font_size = 8
                    error_leading = error_font_size * 1.2
                    if y - error_leading < margin_bottom: 
                        p.showPage()
                        y = height - margin_top
                    p.setFont("Helvetica", error_font_size)
                    p.drawString(margin_left, y - error_font_size, error_message_text)
                    y -= (error_leading + (0.05 * inch)) # Space after error message
                except Exception as e: # Catch other general exceptions during PIL processing etc.
                    logger.error(f"Error processing S3 attachment (ID: {attachment.id}, Key: {object_key}, Caption: '{image_caption}') for PDF: {e}", exc_info=True)
                    # Draw an error message in the PDF for this specific image
                    error_message_text = f"[Error processing image: {filename_for_fallback_caption}]"
                    error_font_size = 8
                    error_leading = error_font_size * 1.2
                    if y - error_leading < margin_bottom: 
                        p.showPage()
                        y = height - margin_top
                    p.setFont("Helvetica", error_font_size)
                    p.drawString(margin_left, y - error_font_size, error_message_text)
                    y -= (error_leading + (0.05 * inch)) # Space after error message

        y -= 0.1 * inch # Final padding after all attachments, before next section (e.g., Hashtags)
    elif not s3_client:
        logger.warning(f"S3 client not initialized. Cannot process image_attachments for bulletin ID: {getattr(bulletin, 'id', 'N/A')}")
    else: # bulletin.image_attachments is None or empty (or now an empty list)
        logger.info(f"No image attachments found or bulletin.image_attachments is empty for bulletin ID: {getattr(bulletin, 'id', 'N/A')}")
    
    # --- Hashtags ---
    # if bulletin.hashtags and bulletin.hashtags.strip():
    #     title = "Hashtags"
    #     # Prepare hashtag string: ensure starts with #, space separated
    #     tags = [f"#{tag.strip()}" for tag in bulletin.hashtags.split(',') if tag.strip()]
    #     content_text = " ".join(tags)
        
    #     section_style = style_colors.get(title, {"bg": "#f0f0f0", "border": "#cccccc"})
    #     y = draw_section(y, title, content_text, section_style["bg"], section_style["border"], text_font="Helvetica-Oblique", text_size=10)
    #     y -= 0.1*inch

    # --- Footer with Bulletin ID ---
    # This section is now handled by BulletinCanvas, so it will be removed.
    # Ensure footer is at the bottom
    # if y < margin_bottom + line_height_small + (0.1*inch) : # If not enough space for ID line
    #      p.showPage() 
    #      # Consider drawing footer on every page if this behavior is not desired.
    
    # p.setFont("Helvetica", 8)
    # id_text = f"Bulletin ID: {bulletin.id}"
    # p.drawString(margin_left, margin_bottom + (0.05*inch), id_text) # Draw at fixed bottom position
    
    # p.showPage() # This explicit showPage before save is removed as BulletinCanvas.save handles the last page.
    p.save()
    buffer.seek(0)
    logger.info(f"PDF generation complete for bulletin ID: {getattr(bulletin, 'id', 'N/A')}. PDF size: {len(buffer.getvalue())} bytes.")
    return buffer
