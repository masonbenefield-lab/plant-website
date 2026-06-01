-- Allow sold_out listings to be viewed by everyone, not just the seller.
-- Previously only 'active' listings were publicly readable, which caused
-- sold-out listing pages to return 404 for buyers who purchased the item.

drop policy "Active listings are viewable by everyone" on listings;

create policy "Active and sold-out listings are viewable by everyone"
  on listings for select
  using (status in ('active', 'sold_out') or auth.uid() = seller_id);
