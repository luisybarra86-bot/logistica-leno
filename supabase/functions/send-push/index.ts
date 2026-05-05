import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC  = 'BEl1HQfNe-08WKf79ztUCfsJ3Ki-KELCNeVBif5O1rWmV6mGnzUeF4BXiWYJn8x84iDd4ZFjr2M8Sw0mUMyahyM';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:luisybarra86@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { type, table, record, old_record } = body;

    if (table !== 'pedidos') return new Response('ok');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: subs } = await supabase.from('push_subscriptions').select('*');
    if (!subs?.length) return new Response('no subs');

    const toSend: { sub: any; title: string; body: string }[] = [];

    if (type === 'INSERT') {
      // Admins: nuevo pedido
      subs.filter(s => s.role === 'admin').forEach(sub =>
        toSend.push({ sub, title: '📋 Nuevo pedido', body: 'Se creó un pedido nuevo' })
      );
      // Repartidor asignado
      if (record.repartidor_id) {
        subs.filter(s => s.repartidor_id === record.repartidor_id).forEach(sub =>
          toSend.push({ sub, title: '📋 Pedido asignado', body: 'Revisá tus entregas' })
        );
      }
    } else if (type === 'UPDATE') {
      const estadoCambio = old_record?.estado !== record.estado;
      const repCambio    = old_record?.repartidor_id !== record.repartidor_id;

      if (estadoCambio) {
        const msgs: Record<string, [string, string]> = {
          en_ruta:   ['🚚 En ruta',           'Un repartidor inició la ruta'],
          entregado: ['✅ Entrega confirmada', 'Pedido entregado correctamente'],
          parcial:   ['⚠️ Entrega parcial',   'Se entregó parcialmente'],
          fallido:   ['❌ Entrega fallida',    'No se pudo realizar la entrega'],
        };
        const m = msgs[record.estado];
        if (m) {
          // Notificar admins
          subs.filter(s => s.role === 'admin').forEach(sub =>
            toSend.push({ sub, title: m[0], body: m[1] })
          );
        }
      }

      if (repCambio && record.repartidor_id) {
        subs.filter(s => s.repartidor_id === record.repartidor_id).forEach(sub =>
          toSend.push({ sub, title: '📋 Pedido asignado', body: 'Tenés un nuevo pedido' })
        );
      }
    }

    // Enviar y limpiar suscripciones vencidas
    const results = await Promise.allSettled(toSend.map(({ sub, title, body }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      )
    ));

    // Eliminar suscripciones inválidas (410 = dispositivo ya no suscrito)
    const stale = toSend
      .filter((_, i) => {
        const r = results[i];
        return r.status === 'rejected' && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404);
      })
      .map(({ sub }) => sub.endpoint);

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale);
    }

    return new Response(JSON.stringify({ sent: toSend.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response(e.message, { status: 500 });
  }
});
