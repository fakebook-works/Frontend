import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { ListingDetailDto, ListingDto } from '../api/types'
import { ListingStatus, ListingType } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { categoryLabel, firstName, LISTING_CATEGORIES, money, timeAgo, timeLeft } from '../lib/format'
import { useI18n } from '../i18n'

interface MarketplacePageProps {
  onOpenProfile: (userId: string) => void
}

export function MarketplacePage({ onOpenProfile }: MarketplacePageProps) {
  const { t } = useI18n()
  const [listings, setListings] = useState<ListingDto[]>([])
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(false)
  const [category, setCategory] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = mine
      ? api.myListings()
      : api.listings({ category: category != null ? String(category) : undefined, q: debounced || undefined })
    load
      .then((rows) => {
        if (!cancelled) setListings(rows)
      })
      .catch(() => {
        if (!cancelled) setListings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mine, category, debounced])

  function reload() {
    // Re-trigger the load effect by nudging the debounced term reference.
    setDebounced((d) => d)
    setListings([])
    setLoading(true)
    const load = mine
      ? api.myListings()
      : api.listings({ category: category != null ? String(category) : undefined, q: debounced || undefined })
    load.then(setListings).catch(() => setListings([])).finally(() => setLoading(false))
  }

  return (
    <div className="mk">
      <aside className="mk-rail">
        <h1 className="mk-rail-title">{t('marketplace')}</h1>
        <button type="button" className="btn-primary block" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={18} /> {t('createNewListing')}
        </button>

        <label className="mk-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Marketplace"
            aria-label="Search Marketplace"
          />
        </label>

        <nav className="mk-tabs">
          <button type="button" className={`mk-tab${!mine ? ' active' : ''}`} onClick={() => { setMine(false); setSelected(null) }}>
            <span className="rail-icon"><Icon name="marketplace" size={20} /></span>
            {t('browseAll')}
          </button>
          <button type="button" className={`mk-tab${mine ? ' active' : ''}`} onClick={() => { setMine(true); setSelected(null) }}>
            <span className="rail-icon"><Icon name="tag" size={20} /></span>
            {t('yourListings')}
          </button>
        </nav>

        <h3 className="mk-rail-h">{t('categories')}</h3>
        <div className="mk-cats">
          <button type="button" className={`mk-cat${category == null ? ' active' : ''}`} onClick={() => { setCategory(null); setSelected(null) }}>
            {t('allCategories')}
          </button>
          {LISTING_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              className={`mk-cat${category === c.value ? ' active' : ''}`}
              onClick={() => { setCategory(c.value); setSelected(null) }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="mk-main">
        {selected ? (
          <ListingDetail
            id={selected}
            onBack={() => { setSelected(null); reload() }}
            onOpenProfile={onOpenProfile}
          />
        ) : (
          <>
            <div className="mk-head">
              <h2>{mine ? t('yourListings') : category != null ? categoryLabel(category) : t('todaysPicks')}</h2>
            </div>
            {loading ? (
              <div className="mk-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className="mk-card skeleton" key={i}>
                    <div className="mk-card-img" />
                    <div className="mk-card-body">
                      <span className="sk-line sk-price" />
                      <span className="sk-line" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="card mk-empty">
                <Icon name="marketplace" size={40} />
                <h3>{mine ? 'You have no listings yet' : 'Nothing here yet'}</h3>
                <p>{mine ? 'Create a listing to start selling.' : 'Be the first to list something for sale.'}</p>
                <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                  Create new listing
                </button>
              </div>
            ) : (
              <div className="mk-grid">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} onOpen={() => setSelected(l.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {createOpen && (
        <CreateListingModal
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false)
            setMine(false)
            setSelected(created.id)
          }}
        />
      )}
    </div>
  )
}

function ListingCard({ listing, onOpen }: { listing: ListingDto; onOpen: () => void }) {
  const { t } = useI18n()
  const isAuction = listing.type === ListingType.Auction
  const ended = listing.status === ListingStatus.Ended
  return (
    <button type="button" className="mk-card" onClick={onOpen}>
      <div className="mk-card-img">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="mk-noimg"><Icon name="marketplace" size={32} /></span>
        )}
        {isAuction && !ended && <span className="mk-badge">{t('auction')}</span>}
        {ended && <span className="mk-badge ended">{t('ended')}</span>}
      </div>
      <div className="mk-card-body">
        <span className="mk-price">{money(listing.currentPrice)}</span>
        <span className="mk-title">{listing.title}</span>
        <span className="mk-meta">
          {listing.location ?? t('localPickup')}
          {isAuction && !ended && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="mk-timeleft"><Icon name="clock" size={12} /> {timeLeft(listing.auctionEndsAt)}</span>
            </>
          )}
        </span>
        {isAuction && listing.bidCount > 0 && (
          <span className="mk-bidcount">{listing.bidCount} {listing.bidCount === 1 ? 'bid' : 'bids'}</span>
        )}
      </div>
    </button>
  )
}

function ListingDetail({
  id,
  onBack,
  onOpenProfile,
}: {
  id: string
  onBack: () => void
  onOpenProfile: (userId: string) => void
}) {
  const { t } = useI18n()
  const [d, setD] = useState<ListingDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [bid, setBid] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listing(id)
      .then((res) => {
        if (cancelled) return
        setD(res)
        setBid(res.type === ListingType.Auction ? String(res.minNextBid) : '')
      })
      .catch(() => {
        if (!cancelled) setD(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Live countdown while an auction is running.
  useEffect(() => {
    if (!d || d.type !== ListingType.Auction || d.status !== ListingStatus.Active) return
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [d])

  async function placeBid(e: FormEvent) {
    e.preventDefault()
    if (!d) return
    const amount = Number(bid)
    if (!Number.isFinite(amount) || amount < d.minNextBid) {
      setError(`Enter at least ${money(d.minNextBid)}.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await api.placeBid(d.id, amount)
      setD(updated)
      setBid(String(updated.minNextBid))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your bid.')
    } finally {
      setBusy(false)
    }
  }

  async function buy() {
    if (!d) return
    setBusy(true)
    setError(null)
    try {
      setD(await api.buyListing(d.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete the purchase.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!d) return
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.deleteListing(d.id)
      onBack()
    } catch {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="boot inline">
        <span className="spinner" />
      </div>
    )
  }
  if (!d) {
    return (
      <div className="card mk-empty">
        <h3>Listing unavailable</h3>
        <button type="button" className="btn-soft" onClick={onBack}>Back to Marketplace</button>
      </div>
    )
  }

  const isAuction = d.type === ListingType.Auction
  const active = d.status === ListingStatus.Active

  return (
    <div className="mk-detail-wrap">
      <button type="button" className="btn-text mk-back" onClick={onBack}>
        <Icon name="caret" size={18} className="rot90" /> Marketplace
      </button>

      <div className="card mk-detail">
        <div className="mk-detail-media">
          {d.imageUrl ? <img src={d.imageUrl} alt="" /> : <span className="mk-noimg"><Icon name="marketplace" size={56} /></span>}
        </div>

        <div className="mk-detail-info">
          <h1 className="mk-detail-title">{d.title}</h1>
          <div className="mk-detail-price">{money(d.currentPrice)}</div>

          {isAuction && (
            <div className={`mk-auction-bar${active ? '' : ' ended'}`}>
              <Icon name="clock" size={16} />
              {active ? timeLeft(d.auctionEndsAt) : 'Auction ended'}
              <span aria-hidden="true"> · </span>
              {d.bidCount} {d.bidCount === 1 ? 'bid' : 'bids'}
            </div>
          )}

          <div className="mk-detail-sub">
            <span>{categoryLabel(d.category)}</span>
            {d.location && <><span aria-hidden="true"> · </span><span><Icon name="location" size={13} /> {d.location}</span></>}
            <span aria-hidden="true"> · </span>
            <span>Listed {timeAgo(d.createdAt)}</span>
          </div>

          {/* Action area */}
          {d.isMine ? (
            <div className="mk-action">
              <p className="muted small">This is your listing.</p>
              <button type="button" className="btn-soft block" onClick={remove} disabled={busy}>
                <Icon name="trash" size={16} /> Delete listing
              </button>
            </div>
          ) : !active ? (
            <div className="mk-action">
              <p className="mk-status-note">
                {d.status === ListingStatus.Sold && 'This item has been sold.'}
                {d.status === ListingStatus.Ended && (d.buyer ? `Auction ended. Winner: ${d.buyer.displayName}.` : 'Auction ended with no bids.')}
                {d.status === ListingStatus.Cancelled && 'This listing was removed.'}
              </p>
            </div>
          ) : isAuction ? (
            <form className="mk-action" onSubmit={placeBid}>
              <label className="mk-bid-label">
                Your bid (min {money(d.minNextBid)})
                <div className="mk-bid-row">
                  <span className="mk-bid-prefix">$</span>
                  <input
                    type="number"
                    min={d.minNextBid}
                    step="1"
                    value={bid}
                    onChange={(e) => setBid(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </label>
              <button type="submit" className="btn-primary block" disabled={busy}>
                {busy ? t('placingBid') : t('placeBid')}
              </button>
              {d.highestBidder && (
                <p className="muted small">Highest bidder: {firstName(d.highestBidder.displayName)}</p>
              )}
            </form>
          ) : (
            <div className="mk-action">
              <button type="button" className="btn-primary block" onClick={buy} disabled={busy}>
                {busy ? t('processing') : t('buyNow')}
              </button>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="mk-seller">
            <Avatar name={d.seller.displayName} src={d.seller.avatarUrl} size={40} onClick={() => onOpenProfile(d.seller.id)} />
            <div>
              <button type="button" className="mk-seller-name" onClick={() => onOpenProfile(d.seller.id)}>
                {d.seller.displayName}
              </button>
              <span className="muted small">Seller</span>
            </div>
          </div>

          {d.description && (
            <div className="mk-section">
              <h3>Description</h3>
              <p className="mk-desc">{d.description}</p>
            </div>
          )}

          {isAuction && d.bids.length > 0 && (
            <div className="mk-section">
              <h3>Bid history</h3>
              <ul className="mk-bids">
                {d.bids.map((b) => (
                  <li key={b.id}>
                    <Avatar name={b.bidder.displayName} src={b.bidder.avatarUrl} size={28} />
                    <span className="mk-bids-name">{b.bidder.displayName}</span>
                    <span className="mk-bids-amount">{money(b.amount)}</span>
                    <span className="muted small">{timeAgo(b.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateListingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (created: ListingDetailDto) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [category, setCategory] = useState(LISTING_CATEGORIES[1].value)
  const [location, setLocation] = useState('')
  const [type, setType] = useState<number>(ListingType.FixedPrice)
  const [price, setPrice] = useState('')
  const [auctionDays, setAuctionDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuction = type === ListingType.Auction

  async function submit(e: FormEvent) {
    e.preventDefault()
    const p = Number(price)
    if (!title.trim()) {
      setError(t('listingTitleRequired'))
      return
    }
    if (!Number.isFinite(p) || p < 0) {
      setError(t('listingPriceInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await api.createListing({
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || null,
        category,
        location: location.trim() || null,
        type,
        price: p,
        auctionDays: isAuction ? auctionDays : null,
      })
      onCreated(created)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('createListingError'))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <form className="modal edit-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="modal-head">
          <h2>{t('createListingTitle')}</h2>
          <button type="button" className="icon-circle subtle" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="modal-body edit-body">
          <div className="mk-type-toggle">
            <button type="button" className={`mk-type${type === ListingType.FixedPrice ? ' active' : ''}`} onClick={() => setType(ListingType.FixedPrice)}>
              Fixed price
            </button>
            <button type="button" className={`mk-type${type === ListingType.Auction ? ' active' : ''}`} onClick={() => setType(ListingType.Auction)}>
              Auction
            </button>
          </div>

          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} autoFocus />
          </label>

          <div className="field-row">
            <label className="field">
              <span>{isAuction ? 'Starting bid' : 'Price'}</span>
              <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(Number(e.target.value))}>
                {LISTING_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          {isAuction && (
            <label className="field">
              <span>Auction length</span>
              <select value={auctionDays} onChange={(e) => setAuctionDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
                <option value={10}>10 days</option>
              </select>
            </label>
          )}

          <label className="field">
            <span>Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hanoi" />
          </label>

          <label className="field">
            <span>Photo URL</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </label>

          {imageUrl.trim() && (
            <div className="post-media composer-preview">
              <img src={imageUrl} alt="" />
            </div>
          )}

          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </label>

          {error && <p className="form-error">{error}</p>}
        </div>
        <footer className="modal-foot">
          <button type="submit" className="btn-primary block" disabled={busy}>
            {busy ? t('publishing') : t('publishListing')}
          </button>
        </footer>
      </form>
    </div>
  )
}
