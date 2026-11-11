drop table if exists public.notifications, public.reports, public.user_blocks, public.messages,
  public.conversation_participants, public.conversations, public.reviews,
  public.portfolio_items, public.portfolio_collections cascade;
drop function if exists private.messages_guard();
drop function if exists private.is_participant(uuid);
drop function if exists private.reviews_aggregate();
drop function if exists private.reviews_fill_and_aggregate();
