/** PDFs open directly; Word files open in Microsoft's online viewer so they render without Word installed. */
export function filePreviewUrl(file: { url: string; contentType: string }) {
  return file.contentType === 'application/pdf' ? file.url : `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`;
}
