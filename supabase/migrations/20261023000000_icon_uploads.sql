-- Favicons can be uploaded as .ico too.
update storage.buckets
set allowed_mime_types = array[
	'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'
]
where id = 'media';
