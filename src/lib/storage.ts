import { supabase } from './supabase';

export async function uploadFile(file: File): Promise<string> {
  const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(uniqueName, file);
    
  if (error) {
    console.error('Upload error:', error);
    throw error;
  }
  
  const { data: publicUrlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(uniqueName);
    
  return publicUrlData.publicUrl;
}

export async function uploadBase64(base64Str: string, fileName: string): Promise<string> {
  if (!base64Str.startsWith('data:')) return base64Str; // Already a URL

  const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return base64Str;

  const contentType = matches[1];
  const base64Data = matches[2];
  
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  const blob = new Blob(byteArrays, { type: contentType });
  
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  
  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(uniqueName, blob, { contentType });
    
  if (error) {
    console.error('Upload error:', error);
    return base64Str;
  }
  
  const { data: publicUrlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(uniqueName);
    
  return publicUrlData.publicUrl;
}
