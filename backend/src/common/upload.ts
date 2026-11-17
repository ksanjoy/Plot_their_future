/** The subset of a Multer file the handlers rely on. */
export interface UploadedFileData {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}
