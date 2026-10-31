import { PDFParse } from 'pdf-parse';
import { ServiceError } from '../../foundation/errors';
export async function extractPdf(base64: string): Promise<string> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw new ServiceError('unsupported_input', 400, '文件编码无效');
  const data = Buffer.from(base64, 'base64');
  if (data.length > 5 * 1024 * 1024)
    throw new ServiceError('unsupported_input', 413, 'PDF 请小于 5MB');
  if (data.subarray(0, 5).toString() !== '%PDF-')
    throw new ServiceError('unsupported_input', 400, '请选择有效的 PDF 文件');
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const info = await parser.getInfo();
    if (info.total > 30) throw new ServiceError('unsupported_input', 400, '简历请勿超过 30 页');
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text)
      throw new ServiceError(
        'unsupported_input',
        422,
        '该 PDF 没有可提取文字，请上传文字版 PDF 或手动粘贴内容',
      );
    if (text.length > 100000)
      throw new ServiceError('unsupported_input', 400, '简历文字过长，请精简后上传');
    return text;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(
      'unsupported_input',
      422,
      '无法读取 PDF，请检查文件是否损坏或加密，或改用文字版 PDF',
    );
  } finally {
    await parser.destroy();
  }
}
