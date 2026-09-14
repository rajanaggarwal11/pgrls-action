-- Three tables, three states. Run as a superuser once per job.
create role app login password 'app-password';
grant usage on schema public to app;

create table exposed_no_rls (id int);
create table exposed_not_forced (id int);
alter table exposed_not_forced enable row level security;
create policy p on exposed_not_forced using (true);

create table protected_table (id int);
alter table protected_table enable row level security;
alter table protected_table force row level security;
create policy p on protected_table using (true);

grant select on all tables in schema public to app;
