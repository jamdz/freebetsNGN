import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAdminApi,writeAudit } from '@/lib/admin-api'
const limits:Record<string,number>={favicon:1024*1024,logo:2*1024*1024,og:2*1024*1024}
function hasExpectedImageSignature(type:string,bytes:Uint8Array) {
  if(type==='image/png')return bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a
  if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
  if(type==='image/webp')return bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  return false
}
export async function POST(request:Request){const auth=await requireAdminApi();if('response'in auth)return auth.response;const form=await request.formData();const file=form.get('file');const kind=String(form.get('kind')??'');if(!(file instanceof File)||!limits[kind])return NextResponse.json({error:'Image and valid kind are required'},{status:400});if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size===0||file.size>limits[kind])return NextResponse.json({error:`Use PNG, JPEG, or WebP under ${kind==='favicon'?1:2} MB`},{status:400});if(!hasExpectedImageSignature(file.type,new Uint8Array(await file.slice(0,12).arrayBuffer())))return NextResponse.json({error:'The uploaded image content does not match its file type'},{status:400});const extension=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];const path=`${kind}/${randomUUID()}.${extension}`;const {data,error}=await auth.supabase.storage.from('site-assets').upload(path,file,{contentType:file.type,upsert:false});if(error)return NextResponse.json({error:error.message},{status:500});const {data:{publicUrl}}=auth.supabase.storage.from('site-assets').getPublicUrl(data.path);await writeAudit(auth.supabase,'upload_site_asset','site_asset',data.path,{kind,content_type:file.type,size:file.size});return NextResponse.json({url:publicUrl})}
