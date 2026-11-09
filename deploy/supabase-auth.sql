create schema if not exists logicalab_private;
revoke all on schema logicalab_private from public, anon;
grant usage on schema logicalab_private to authenticated;

create or replace function logicalab_private.excluir_identidade_atual()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  participante uuid := (select auth.uid());
begin
  if participante is null then
    raise exception 'Sessão autenticada necessária';
  end if;
  delete from auth.sessions where user_id = participante;
  delete from auth.users where id = participante;
end;
$$;
revoke all on function logicalab_private.excluir_identidade_atual() from public, anon;
grant execute on function logicalab_private.excluir_identidade_atual() to authenticated;

create or replace function public.excluir_minha_conta_logicalab()
returns void
language sql
security invoker
set search_path = ''
as $$
  select logicalab_private.excluir_identidade_atual();
$$;
revoke all on function public.excluir_minha_conta_logicalab() from public, anon;
grant execute on function public.excluir_minha_conta_logicalab() to authenticated;
