-- =====================================================================
-- Tiny assertion helpers — TEST HARNESS ONLY
--
-- pgTAP would be the heavier option; these few functions are enough for
-- the security assertions this project needs and add no dependency.
-- =====================================================================

create schema if not exists test;

create table if not exists test.results (
  id          serial primary key,
  description text not null,
  passed      boolean not null,
  detail      text
);

create or replace function test.ok(passed boolean, description text, detail text default null)
returns void
language plpgsql
as $$
begin
  insert into test.results (description, passed, detail)
  values (description, coalesce(passed, false), detail);
end;
$$;

/**
 * Assert that a statement is REFUSED.
 *
 * Most of the security tests in this project are of the form "this must not
 * be possible", so the interesting assertion is that an error was raised.
 * A statement that silently returns zero rows is a different outcome from a
 * statement that is rejected, and both matter.
 */
create or replace function test.throws(statement text, description text)
returns void
language plpgsql
as $$
begin
  execute statement;
  perform test.ok(false, description, 'Expected an error, but the statement succeeded');
exception
  when others then
    perform test.ok(true, description, 'Refused with: ' || sqlerrm);
end;
$$;

/** Assert a query returns exactly the expected number of rows. */
create or replace function test.row_count(query text, expected bigint, description text)
returns void
language plpgsql
as $$
declare
  actual bigint;
begin
  execute format('select count(*) from (%s) q', query) into actual;
  perform test.ok(
    actual = expected,
    description,
    format('expected %s row(s), got %s', expected, actual)
  );
exception
  when others then
    perform test.ok(false, description, 'Query errored: ' || sqlerrm);
end;
$$;

/**
 * Assert how many rows a statement actually changed.
 *
 * Distinct from test.throws: when RLS hides a row, an UPDATE naming that row
 * does not fail, it quietly affects nothing. That silence is the security
 * property, so it deserves its own assertion.
 */
create or replace function test.affected_rows(
  statement text,
  expected bigint,
  description text
)
returns void
language plpgsql
as $$
declare
  actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  perform test.ok(
    actual = expected,
    description,
    format('expected %s affected row(s), got %s', expected, actual)
  );
exception
  when others then
    perform test.ok(false, description, 'Statement errored: ' || sqlerrm);
end;
$$;

/**
 * Act as the trusted server side, which is how Supabase seeds data and how
 * admin server actions run. Used for test fixtures.
 */
create or replace function test.act_as_service()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
end;
$$;

/**
 * Act as someone holding the database credentials directly — the Supabase
 * SQL editor, or psql. There is no JWT at all, so `auth.uid()` is NULL and
 * the JWT role is unset; RLS is bypassed by the connecting superuser.
 *
 * This is how the very first administrator is created on a new project, and
 * it is deliberately NOT the same as the service role: the claims are
 * cleared at session scope so a test cannot pass through the service-role
 * exemption by accident.
 */
create or replace function test.act_as_sql_editor()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
end;
$$;

/** Become a signed-in application user, the way Supabase presents one. */
create or replace function test.login_as(user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

create or replace function test.logout()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

-- Assertions run *while impersonating* an application role, so those roles
-- need access to the harness itself. Deliberately NOT security definer: if
-- these functions ran as the owner, the statements they execute would run
-- as superuser and quietly bypass the very RLS policies under test.
grant usage on schema test to anon, authenticated, service_role;
grant select, insert on test.results to anon, authenticated, service_role;
grant usage, select on all sequences in schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;

/** Print results and fail loudly if anything did not pass. */
create or replace function test.report()
returns void
language plpgsql
as $$
declare
  r        record;
  failures int;
  total    int;
begin
  select count(*) filter (where not passed), count(*) into failures, total from test.results;

  for r in select * from test.results order by id loop
    raise notice '%  %', case when r.passed then '  PASS' else '✖ FAIL' end, r.description;
    if not r.passed then
      raise notice '        %', coalesce(r.detail, '(no detail)');
    end if;
  end loop;

  raise notice '';
  raise notice '% of % assertions passed', total - failures, total;

  if failures > 0 then
    raise exception '% security assertion(s) FAILED', failures;
  end if;
end;
$$;
