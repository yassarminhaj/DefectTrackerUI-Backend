# Attachments And Inline Assets Module Test Spec

## Scope

- Standalone attachment upload/list/delete/content streaming.
- Inline screenshot upload/list/delete/content streaming from Steps to Replicate rich text.
- Authenticated and context-scoped access to defect child records.
- Phase 1 uses JSON base64 `contentDataUrl` uploads and writes physical files under `FILE_STORAGE_ROOT`.

## UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| ATTACH-INLINE-UI-001 | Create defect uploads selected attachment | Select an allowed attachment on `defect_create.html`, save the defect, open detail. | Detail attachments tab lists the uploaded file, `storage_key` points to a physical file, and Download streams the same file. |
| ATTACH-INLINE-UI-002 | Edit defect uploads selected attachment | Select an allowed attachment on `defect_edit.html`, save changes, reopen detail/edit. | Attachment appears in the attachment table, history records upload activity, and the stored file exists under the defect folder. |
| ATTACH-INLINE-UI-003 | Create defect registers pasted inline screenshot | Paste an image into Steps to Replicate on create, save, inspect detail payload/API. | Image remains inline in Steps HTML, `inlineAssets` contains metadata for the pasted screenshot, and the inline content endpoint streams the image bytes. |
| ATTACH-INLINE-UI-004 | Edit defect registers new pasted inline screenshot | Paste a new image into Steps to Replicate on edit, save, reload. | Image remains inline and new inline metadata/file storage is registered without duplicating existing registered images. |
| ATTACH-INLINE-UI-005 | File validation blocks unsupported files | Select an unsupported file extension in create/edit. | Field validation reports the unsupported type before submit. |
| ATTACH-INLINE-UI-006 | File validation blocks files over 5 MB | Select a file larger than 5 MB in create/edit. | Field validation reports the size limit before submit. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| ATTACH-INLINE-API-001 | Attachment list requires auth | `GET /api/v1/defects/{id}/attachments` without bearer token | `401 unauthorized`. |
| ATTACH-INLINE-API-002 | Attachment upload succeeds | `POST /api/v1/defects/{id}/attachments` with supported filename, size, and `contentDataUrl` | `201`, attachment record and history event are created, and `storage_key` points to a physical file. |
| ATTACH-INLINE-API-003 | Attachment upload rejects unsupported extension | `POST /api/v1/defects/{id}/attachments` with `.csv` or unknown extension | `400 validation_error`, no attachment row. |
| ATTACH-INLINE-API-004 | Attachment upload rejects oversize file | `POST /api/v1/defects/{id}/attachments` with `fileSizeBytes > 5242880` | `400 validation_error`, no attachment row. |
| ATTACH-INLINE-API-005 | Attachment upload rejects missing content | `POST /api/v1/defects/{id}/attachments` without `contentDataUrl` | `400 validation_error`, no attachment row, no file written. |
| ATTACH-INLINE-API-006 | Attachment child route respects context | Read or mutate a Test defect child record under Prod context | `404 not_found`. |
| ATTACH-INLINE-API-007 | Inline image upload succeeds | `POST /api/v1/defects/{id}/inline-assets` with png/jpg metadata and `contentDataUrl` | `201`, inline asset row and history event are created, and `storage_key` points to a physical image file. |
| ATTACH-INLINE-API-008 | Inline image rejects non-image metadata | `POST /api/v1/defects/{id}/inline-assets` with `text/plain` | `400 validation_error`, no inline asset row. |
| ATTACH-INLINE-API-009 | Inline dimension update validates values | `PATCH /api/v1/defects/{id}/inline-assets/{assetId}` with zero width | `400 validation_error`. |
| ATTACH-INLINE-API-010 | Delete operations soft delete | `DELETE` attachment or inline asset | `204`, row remains but `is_deleted=true`. |
| ATTACH-INLINE-API-011 | Attachment content streams file | `GET /api/v1/defects/{id}/attachments/{attachmentId}/content` | `200`, response bytes match the uploaded file, and `Content-Disposition` is an attachment download. |
| ATTACH-INLINE-API-012 | Inline content streams image | `GET /api/v1/defects/{id}/inline-assets/{assetId}/content` | `200`, response bytes match the uploaded image and content type remains image/png or image/jpeg. |
| ATTACH-INLINE-API-013 | Missing physical file is visible | Remove or isolate the stored file and call either content endpoint | `500 file_missing`, making DB/filesystem drift visible. |

## Notes For Automation

- Use disposable defects created in the same test run.
- Always pass bearer token and `X-Data-Context` for positive cases.
- Use `X-Data-Context: Prod` against a known Test defect for context boundary assertions.
- Verify DB rows in `defect_attachments`, `defect_inline_assets`, and `defect_history_events`.
- Resolve each uploaded row's `storage_key` under `FILE_STORAGE_ROOT` and verify the physical file exists with the expected byte size.
- For content endpoints, compare response bytes to the original upload payload, not only metadata.
