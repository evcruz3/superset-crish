import facebook
import logging
import tempfile # For handling temporary image files
import os
import requests # For downloading image from URL
import json # Ensure json is imported


logger = logging.getLogger(__name__)

def get_facebook_graph_api(access_token):
    """
    Initializes and returns a Facebook GraphAPI object.

    :param access_token: The Page Access Token.
    :return: A facebook.GraphAPI instance.
    :raises: ValueError if access_token is not provided.
    """
    if not access_token:
        logger.error("Facebook Page Access Token is missing.")
        raise ValueError("Facebook Page Access Token is required.")
    try:
        graph = facebook.GraphAPI(access_token=access_token)
        logger.info("Facebook GraphAPI initialized successfully.")
        return graph
    except Exception as e:
        logger.error(f"Failed to initialize Facebook GraphAPI: {e}", exc_info=True)
        raise

def upload_single_photo_to_facebook(graph, page_id, image_caption, image_url=None, local_image_path=None, published=True):
    """
    Uploads a single photo to a Facebook page's photos, optionally unpublished.

    :param graph: An initialized facebook.GraphAPI object.
    :param page_id: The ID of the Facebook Page.
    :param image_caption: The caption for this specific photo.
    :param image_url: (Optional) URL of an image to download.
    :param local_image_path: (Optional) Filesystem path to a local image.
    :param published: (Optional) Boolean, True to publish immediately, False for unpublished (for later use in a post).
    :return: The ID of the uploaded photo.
    :raises: Exception if the upload fails.
    """
    if not (image_url or local_image_path):
        raise ValueError("Either image_url or local_image_path must be provided.")

    tmp_image_for_posting = None
    try:
        if image_url and not local_image_path:
            logger.info(f"Downloading image from URL: {image_url} for Facebook photo upload.")
            response = requests.get(image_url, stream=True)
            response.raise_for_status()
            file_extension = os.path.splitext(image_url)[1] if os.path.splitext(image_url)[1] else '.jpg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp_file.write(chunk)
                tmp_image_for_posting = tmp_file.name
            logger.info(f"Image downloaded to temporary file: {tmp_image_for_posting}")
            image_to_upload_path = tmp_image_for_posting
        elif local_image_path:
            image_to_upload_path = local_image_path
        else:
            # This case should be caught by the initial check, but as a safeguard:
            raise ValueError("No image source provided for photo upload.")

        logger.info(f"Uploading photo to Facebook page {page_id} with caption: '{image_caption}', published: {published}")
        with open(image_to_upload_path, 'rb') as image_file_opened:
            photo_post_params = {
                "message": image_caption,
                "published": published
            }
            # The facebook-sdk might use `album_path` or direct params. `put_photo` often takes message/caption directly.
            # For unpublished photos, usually you post to /{page_id}/photos with published=false
            post_result = graph.put_photo(
                image=image_file_opened,
                # album_path=f"{page_id}/photos", # This is one way, or just use page_id as object_id for put_photo
                message=image_caption, # Caption for the photo itself
                published=published # Control visibility
            )
            # Note: If targeting a specific album, album_path would be f"{ALBUM_ID}/photos"
            # For general page photos, posting to {page_id}/photos (often implied by put_photo) is typical.
            
        uploaded_photo_id = post_result.get('id') or post_result.get('post_id') # ID might be in 'id' or 'post_id'
        if not uploaded_photo_id:
            raise Exception("Failed to get ID from photo upload response.")

        logger.info(f"Successfully uploaded photo to Facebook. Photo ID: {uploaded_photo_id}, Published: {published}")
        return uploaded_photo_id
    finally:
        if tmp_image_for_posting and os.path.exists(tmp_image_for_posting):
            try:
                os.remove(tmp_image_for_posting)
                logger.info(f"Cleaned up temporary photo file: {tmp_image_for_posting}")
            except Exception as e_clean:
                logger.error(f"Error cleaning temporary photo file {tmp_image_for_posting}: {e_clean}")

def create_facebook_feed_post(graph, page_id, message, attached_media_ids=None):
    """
    Creates a feed post on a Facebook page, optionally with attached media (unpublished photos).

    :param graph: An initialized facebook.GraphAPI object.
    :param page_id: The ID of the Facebook Page to post to.
    :param message: The main text message for the feed post.
    :param attached_media_ids: (Optional) List of media IDs (strings) for photos already uploaded as unpublished.
    :return: The ID of the created feed post.
    :raises: Exception if the post fails.
    """
    post_params = {"message": message}
    if attached_media_ids:
        # Format for API: list of dicts, e.g., [{"media_fbid": "id1"}, {"media_fbid": "id2"}]
        media_to_attach = [{"media_fbid": str(media_id)} for media_id in attached_media_ids] # Ensure IDs are strings
        post_params['attached_media'] = json.dumps(media_to_attach) # Convert list of dicts to JSON string
        logger.info(f"Creating Facebook feed post on page {page_id} with message and {len(attached_media_ids)} attached media. JSON: {post_params['attached_media']}")
    else:
        logger.info(f"Creating Facebook feed post on page {page_id} with message only.")

    try:
        post_result = graph.put_object(
            parent_object=page_id,
            connection_name="feed",
            **post_params # Pass parameters, including the JSON string for attached_media
        )
        feed_post_id = post_result.get('id')
        if not feed_post_id:
            raise Exception("Failed to get ID from feed post response.")
        logger.info(f"Successfully created feed post. Post ID: {feed_post_id}")
        return feed_post_id
    except facebook.GraphAPIError as e:
        logger.error(f"Facebook API Error while creating feed post to page {page_id}: {e}", exc_info=True)
        raise Exception(f"Failed to create feed post on Facebook page {page_id}: {e.message}")
    except Exception as e:
        logger.error(f"An unexpected error occurred while creating feed post to page {page_id}: {e}", exc_info=True)
        raise Exception(f"An unexpected error occurred: {e}")

# Example usage (for testing purposes, normally called from DisseminateBulletinView)
# if __name__ == '__main__':
#     # Ensure these are set as environment variables or loaded securely
#     # For testing, you might temporarily hardcode them but remove before committing
#     PAGE_ACCESS_TOKEN = "YOUR_PAGE_ACCESS_TOKEN" 
#     PAGE_ID = "YOUR_PAGE_ID"
    
#     if PAGE_ACCESS_TOKEN == "YOUR_PAGE_ACCESS_TOKEN" or PAGE_ID == "YOUR_PAGE_ID":
#         print("Please replace YOUR_PAGE_ACCESS_TOKEN and YOUR_PAGE_ID with actual values for testing.")
#     else:
#         try:
#             test_graph = get_facebook_graph_api(PAGE_ACCESS_TOKEN)
#             # Test 1: Message only
#             # post_id = post_to_facebook_page(test_graph, PAGE_ID, "Hello from Superset! This is a test post via facebook-sdk.")
#             # print(f"Message-only post successful. Post ID: {post_id}")

#             # Test 2: Message with link
#             # post_id_link = post_to_facebook_page(test_graph, PAGE_ID, "Check out this Superset dashboard!", link="https://superset.apache.org/")
#             # print(f"Link post successful. Post ID: {post_id_link}")
            
#             # Test 3: Message with local image (and link in caption)
#             # Create a dummy image file e.g., 'test_image.png' in the same directory for this to work
#             # Ensure the image path is correct.
#             # image_file_path = "test_image.png" 
#             # with open(image_file_path, "w") as f: f.write("dummy content for a png") # Create a dummy file
#             # post_id_image = post_to_facebook_page(
#             #    test_graph, 
#             #    PAGE_ID, 
#             #    "Superset bulletin image and a link!", 
#             #    link="https://superset.apache.org/docs/installation/installing-superset-from-scratch",
#             #    image_path=image_file_path
#             # )
#             # print(f"Image post successful. Post ID: {post_id_image}")

#         except Exception as e:
#             print(f"An error occurred during testing: {e}") 