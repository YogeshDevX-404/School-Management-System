import { supabase } from '@/lib/supabase';
import type { Notice, NoticeWithAudience, NoticeAudienceRole, NoticePriority, AttachmentType } from '@/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface NoticeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  priority?: NoticePriority | 'all';
  audience?: NoticeAudienceRole | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface NoticeCreatePayload {
  title: string;
  description: string;
  priority: NoticePriority;
  audiences: NoticeAudienceRole[];
  publish_date: string;
  expiry_date?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: AttachmentType | null;
}

export const noticesApi = {
  async list(params: NoticeListParams = {}): Promise<{ data: NoticeWithAudience[]; total: number }> {
    const { page = 1, pageSize = 10, search, priority, audience, dateFrom, dateTo } = params;

    let q = supabase
      .from('notices')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('publish_date', { ascending: false });

    if (search) {
      q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,author_name.ilike.%${search}%`);
    }
    if (priority && priority !== 'all') q = q.eq('priority', priority);
    if (dateFrom) q = q.gte('publish_date', dateFrom);
    if (dateTo) q = q.lte('publish_date', dateTo);

    q = q.range((page - 1) * pageSize, page * pageSize - 1);
    const { data, count, error } = await q;
    if (error) throw error;

    const notices = (data || []) as Notice[];
    if (!notices.length) return { data: [], total: count || 0 };

    const ids = notices.map((n) => n.id);
    const { data: audienceRows, error: audErr } = await supabase
      .from('notice_audience')
      .select('notice_id, role')
      .in('notice_id', ids);
    if (audErr) throw audErr;

    const audienceMap: Record<string, NoticeAudienceRole[]> = {};
    for (const row of audienceRows || []) {
      const na = row as { notice_id: string; role: NoticeAudienceRole };
      if (!audienceMap[na.notice_id]) audienceMap[na.notice_id] = [];
      audienceMap[na.notice_id].push(na.role);
    }

    let result = notices.map((n) => ({
      ...n,
      audiences: audienceMap[n.id] || [],
    })) as NoticeWithAudience[];

    if (audience && audience !== 'all') {
      result = result.filter((n) => n.audiences.includes(audience));
    }

    return { data: result, total: count || 0 };
  },

  async latest(limit = 5): Promise<NoticeWithAudience[]> {
    const { data, error } = await supabase.rpc('get_visible_notices');
    if (error) throw error;
    const notices = (data || []).slice(0, limit) as Notice[];
    if (!notices.length) return [];

    const ids = notices.map((n) => n.id);
    const { data: audienceRows } = await supabase
      .from('notice_audience')
      .select('notice_id, role')
      .in('notice_id', ids);

    const audienceMap: Record<string, NoticeAudienceRole[]> = {};
    for (const row of (audienceRows || []) as { notice_id: string; role: NoticeAudienceRole }[]) {
      if (!audienceMap[row.notice_id]) audienceMap[row.notice_id] = [];
      audienceMap[row.notice_id].push(row.role);
    }

    return notices.map((n) => ({ ...n, audiences: audienceMap[n.id] || [] })) as NoticeWithAudience[];
  },

  async get(id: string): Promise<NoticeWithAudience | null> {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: audienceRows } = await supabase
      .from('notice_audience')
      .select('role')
      .eq('notice_id', id);
    const audiences = (audienceRows || []).map((r) => (r as { role: NoticeAudienceRole }).role);

    return { ...(data as Notice), audiences } as NoticeWithAudience;
  },

  async create(payload: NoticeCreatePayload): Promise<Notice> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) throw new Error('Profile not found');

    const { audiences, ...noticeData } = payload;
    const insertPayload = {
      ...noticeData,
      author_name: (profile as { full_name: string }).full_name,
      author_role: (profile as { role: string }).role,
      author_avatar: (profile as { avatar_url?: string | null }).avatar_url || null,
    };

    const { data, error } = await supabase
      .from('notices')
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;

    const notice = data as Notice;
    if (audiences.length) {
      const audienceRows = audiences.map((role) => ({ notice_id: notice.id, role }));
      const { error: audErr } = await supabase.from('notice_audience').insert(audienceRows);
      if (audErr) throw audErr;
    }

    return notice;
  },

  async update(id: string, payload: Partial<NoticeCreatePayload>): Promise<Notice> {
    const { audiences, ...noticeData } = payload;
    const updateData: Record<string, unknown> = { ...noticeData, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('notices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (audiences) {
      await supabase.from('notice_audience').delete().eq('notice_id', id);
      if (audiences.length) {
        const audienceRows = audiences.map((role) => ({ notice_id: id, role }));
        const { error: audErr } = await supabase.from('notice_audience').insert(audienceRows);
        if (audErr) throw audErr;
      }
    }

    return data as Notice;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('notices')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async uploadAttachment(file: File): Promise<{ url: string; name: string; type: AttachmentType }> {
    if (file.size > MAX_FILE_SIZE) throw new Error('File size must be under 20MB');

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let attachmentType: AttachmentType = 'file';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) attachmentType = 'image';
    else if (ext === 'pdf') attachmentType = 'pdf';
    else if (['doc', 'docx'].includes(ext)) attachmentType = 'word';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) attachmentType = 'excel';

    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from('notice-attachments')
      .upload(path, file, { upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from('notice-attachments').getPublicUrl(path);
    return { url: urlData.publicUrl, name: file.name, type: attachmentType };
  },
};
