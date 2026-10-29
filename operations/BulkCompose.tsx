import { useState } from 'react';
import { useOps, json, errorText, options } from './shared';

type Row = { customer_id: number; name: string; recipient: string | null; eligible: boolean; reason: string | null };
export default function BulkCompose({ ids: initialIds, channel: initialChannel, onClose, onSaved }: {
  ids: number[]; channel: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const { ui: U, t, request } = useOps();
  const [ids, setIds] = useState(initialIds);
  const [channel, setChannel] = useState(initialChannel === 'email' ? 'email' : 'sms');
  const [purpose, setPurpose] = useState('service');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delay, setDelay] = useState('0');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);
  function change(update: () => void) { update(); setReview(null); setKey(crypto.randomUUID()); setError(''); }
  async function submit() {
    setBusy(true); setError('');
    try {
      const payload = { customer_ids: ids, channel, purpose, subject: channel === 'email' ? subject : null, body, delay_minutes: Number(delay), creation_key: key };
      if (!review) {
        const result = await request<{data: {rows: Row[]}}>('/communications/bulk/preview', json('POST', payload));
        setReview(result.data.rows);
      } else {
        const result = await request<{data: {id: number}}>('/communications/bulk', json('POST', payload));
        setDone(result.data.id);
        await onSaved();
      }
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  return <U.Dialog title={t('ops.bulkCompose')} onClose={() => { if (!busy) onClose(); }}>
    <U.Stack>
      {error && <U.Alert error>{error}</U.Alert>}
      {done !== null ? <><U.Alert>{t('ops.bulkQueued')} #{done}</U.Alert><U.Button onClick={onClose}>{t('ops.close')}</U.Button></> : <>
        <U.Alert>{t('ops.bulkHelp')}</U.Alert>
        <p>{t('ops.selectedCustomers')}: {ids.length} / 100</p>
        <U.Field label={t('ops.channel')} type="select" options={options(['sms', 'email'], t)} value={channel} disabled={busy} onChange={v => change(() => setChannel(v))} />
        <U.Field label={t('ops.purpose')} type="select" options={options(['service', 'marketing'], t)} value={purpose} disabled={busy} onChange={v => change(() => setPurpose(v))} />
        {channel === 'email' && <U.Field label={t('ops.subject')} required value={subject} disabled={busy} onChange={v => change(() => setSubject(v))} />}
        <U.Field label={t('ops.message')} type="textarea" required value={body} disabled={busy} onChange={v => change(() => setBody(v))} />
        <p>{t('ops.bulkVariables')}</p>
        <U.Field label={t('ops.delayMinutes')} type="number" min={0} max={525600} value={delay} disabled={busy} onChange={v => change(() => setDelay(v))} />
        {review && <U.Table headers={[t('ops.customer'), t('ops.recipient'), t('ops.status'), t('ops.actions')]} rows={review.map(row => [
          row.name, row.recipient ?? '—', t(row.eligible ? 'ops.eligible' : 'ops.bulk.' + row.reason),
          <U.Button secondary disabled={busy} onClick={() => change(() => setIds(ids.filter(id => id !== row.customer_id)))}>{t('ops.removeRecipient')}</U.Button>,
        ])} />}
        <U.Button disabled={busy || !ids.length || ids.length > 100 || !body.trim() || (channel === 'email' && !subject.trim()) || !!review?.some(row => !row.eligible)} onClick={() => void submit()}>
          {busy ? t('ops.loading') : t(review ? 'ops.confirmBulk' : 'ops.reviewRecipients')}
        </U.Button>
      </>}
    </U.Stack>
  </U.Dialog>;
}
