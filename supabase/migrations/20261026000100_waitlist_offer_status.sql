-- A waitlist spot offered to one dog, waiting for the member to accept (…_waitlist_offers.sql). Its own file:
-- a new enum value can't be used in the transaction that adds it.
alter type public.waitlist_status add value 'offered' after 'waiting';
