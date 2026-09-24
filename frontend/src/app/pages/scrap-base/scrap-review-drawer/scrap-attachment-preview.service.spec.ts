import { vi } from 'vitest';
import { ScrapAttachmentPreviewService } from './scrap-attachment-preview.service';

describe('ScrapAttachmentPreviewService', () => {
  it('creates and revokes only the URLs it owns', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const service = new ScrapAttachmentPreviewService();
    const file = new File(['bytes'], 'evidence.png', { type: 'image/png' });

    expect(service.create(file)).toEqual({
      url: 'blob:one',
      name: 'evidence.png',
      original_filename: 'evidence.png',
    });
    service.revoke('blob:other');
    service.revokeAll();

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:one');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
