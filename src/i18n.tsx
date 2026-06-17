import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Locale =
  | 'en'
  | 'vi'
  | 'ja'
  | 'ko'
  | 'zh-CN'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ru'
  | 'it'
  | 'id'
  | 'th'
  | 'hi'
  | 'ar'
  | 'tr'
  | 'pl'
  | 'nl'

export const LOCALE_STORAGE_KEY = 'fb.locale'

const en: Record<string, string> = {
  languageLabel: 'Language',
  themeLabel: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  gatewayError: 'Server is temporarily unreachable.',
  dismissToast: 'Dismiss notification',
  searchPlaceholder: 'Search Fakebook',
  home: 'Home',
  watch: 'Watch',
  groups: 'Groups',
  noPeopleFound: 'No people found.',
  sent: 'Sent',
  add: 'Add',
  primaryNavLabel: 'Primary',
  seeYourProfile: 'See your profile',
  logout: 'Log out',
  friends: 'Friends',
  video: 'Video',
  saved: 'Saved',
  memories: 'Memories',
  pages: 'Pages',
  settingsPrivacy: 'Settings & privacy',
  seeMore: 'See more',
  seeLess: 'See less',
  footerLinks: 'Privacy · Terms · Advertising · Ad Choices · Cookies · More · Fakebook © 2026',
  friendRequests: 'Friend requests',
  postsLabel: 'posts',
  confirm: 'Confirm',
  delete: 'Delete',
  sponsored: 'Sponsored',
  birthdays: 'Birthdays',
  birthdayText: '<strong>{name}</strong> and <strong>{count} others</strong> have birthdays today.',
  contacts: 'Contacts',
  noContactsYet: 'No contacts yet.',
  editProfile: 'Edit profile',
  backToFeed: 'Back to feed',
  requestSent: 'Request sent',
  addFriend: 'Add friend',
  profileNoPosts: 'No posts yet',
  yourPostsEmpty: 'Your posts will show up here.',
  userPostsEmpty: "{name} hasn't posted anything you can see.",
  nameRequired: 'Name cannot be empty.',
  saveProfileError: 'Could not save your profile.',
  editProfileTitle: 'Edit profile',
  avatarUrlLabel: 'Avatar URL',
  nameLabel: 'Name',
  bioLabel: 'Bio',
  locationLabel: 'Location',
  genderLabel: 'Gender',
  genderPreferNot: 'Prefer not to say',
  genderFemale: 'Female',
  genderMale: 'Male',
  genderCustom: 'Custom',
  birthDateLabel: 'Birth date',
  saving: 'Saving…',
  saveChanges: 'Save changes',
  loadFeedError: 'Could not load your feed.',
  genericError: 'Something went wrong.',
  tryAgain: 'Try again',
  yourFeedQuiet: 'Your feed is quiet',
  feedQuietDesc: 'Share your first post, or add friends to see what they\'re posting.',
  loadingMore: 'Loading…',
  seeMorePosts: 'See more posts',
  storyCreate: 'Create story',
  storyLabel: "{name}'s story",
  uploadFileError: 'Could not upload that file.',
  composeNeedContent: 'Write something or add a photo/video.',
  publishPostError: 'Could not publish your post.',
  composePrompt: "What's on your mind, {name}?",
  liveVideo: 'Live video',
  photoVideo: 'Photo/video',
  feelingActivity: 'Feeling/activity',
  createPost: 'Create post',
  privacyPublic: 'Public',
  privacyFriends: 'Friends',
  privacyOnlyMe: 'Only me',
  uploading: 'Uploading…',
  removeMedia: 'Remove media',
  addToPost: 'Add to your post',
  addPhotoVideo: 'Add photo or video',
  feeling: 'Feeling',
  checkIn: 'Check in',
  posting: 'Posting…',
  post: 'Post',
  edited: 'Edited',
  postOptions: 'Post options',
  editPost: 'Edit post',
  deletePost: 'Delete post',
  cancel: 'Cancel',
  save: 'Save',
  comment: 'comment',
  comments: 'comments',
  share: 'share',
  shares: 'shares',
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
  commentAction: 'Comment',
  shareAction: 'Share',
  loadingComments: 'Loading comments…',
  noCommentsYet: 'No comments yet. Be the first.',
  writeComment: 'Write a comment…',
  sendComment: 'Send comment',
  sharePost: 'Share post',
  saySomethingAboutPost: "Say something about {name}'s post…",
  sharing: 'Sharing…',
  shareNow: 'Share now',
  deletePostConfirm: 'Delete this post? This cannot be undone.',
  marketplace: 'Marketplace',
  createNewListing: 'Create new listing',
  searchMarketplace: 'Search Marketplace',
  browseAll: 'Browse all',
  yourListings: 'Your listings',
  categories: 'Categories',
  allCategories: 'All categories',
  todaysPicks: "Today's picks",
  noListingsYetMine: 'You have no listings yet',
  noListingsYet: 'Nothing here yet',
  noListingsMineDesc: 'Create a listing to start selling.',
  noListingsDesc: 'Be the first to list something for sale.',
  auction: 'Auction',
  ended: 'Ended',
  localPickup: 'Local pickup',
  bid: 'bid',
  bids: 'bids',
  listingUnavailable: 'Listing unavailable',
  backToMarketplace: 'Back to Marketplace',
  auctionEnded: 'Auction ended',
  listed: 'Listed {time}',
  thisIsYourListing: 'This is your listing.',
  deleteListing: 'Delete listing',
  itemSold: 'This item has been sold.',
  auctionEndedWinner: 'Auction ended. Winner: {name}.',
  auctionEndedNoBids: 'Auction ended with no bids.',
  listingRemoved: 'This listing was removed.',
  yourBidMin: 'Your bid (min {amount})',
  placeBid: 'Place bid',
  placingBid: 'Placing bid…',
  highestBidder: 'Highest bidder: {name}',
  buyNow: 'Buy now',
  processing: 'Processing…',
  seller: 'Seller',
  description: 'Description',
  bidHistory: 'Bid history',
  listingTitleRequired: 'Give your listing a title.',
  listingPriceInvalid: 'Enter a valid price.',
  createListingError: 'Could not create the listing.',
  createListingTitle: 'Create new listing',
  fixedPrice: 'Fixed price',
  title: 'Title',
  price: 'Price',
  startingBid: 'Starting bid',
  category: 'Category',
  auctionLength: 'Auction length',
  day: 'day',
  days: 'days',
  photoUrl: 'Photo URL',
  publishListing: 'Publish listing',
  publishing: 'Publishing…',
  loginIncorrect: 'Incorrect username/email or password.',
  loginServerError: 'Could not log in. Is the server running?',
  loginPitch: 'Connect with friends and the world around you on Fakebook.',
  loginEmailOrUsername: 'Email or username',
  loginPassword: 'Password',
  loginLoggingIn: 'Logging in…',
  loginLogIn: 'Log in',
  forgottenPassword: 'Forgotten password?',
  createAccount: 'Create new account',
  demoAccount: 'Demo account: {username} / {password}',
  passwordTooShort: 'Password must be at least 6 characters.',
  usernameTaken: 'That username or email is already taken.',
  createAccountError: 'Could not create the account. Please try again.',
  signUp: 'Sign up',
  signupQuickEasy: "It's quick and easy.",
  fullName: 'Full name',
  username: 'Username',
  emailAddress: 'Email address',
  newPassword: 'New password (min 6 chars)',
  creating: 'Creating…',
  justNow: 'Just now',
  minuteShort: '{count}m',
  hourShort: '{count}h',
  dayShort: '{count}d',
  weekShort: '{count}w',
  endedShort: 'Ended',
  leftShort: '{value} left',
}

const vi: Record<string, string> = {
  languageLabel: 'Ngôn ngữ',
  themeLabel: 'Giao diện',
  themeLight: 'Sáng',
  themeDark: 'Tối',
  gatewayError: 'Máy chủ tạm thời không truy cập được.',
  dismissToast: 'Đóng thông báo',
  searchPlaceholder: 'Tìm kiếm trên Fakebook',
  home: 'Trang chủ',
  watch: 'Video',
  groups: 'Nhóm',
  noPeopleFound: 'Không tìm thấy người dùng.',
  sent: 'Đã gửi',
  add: 'Thêm',
  primaryNavLabel: 'Điều hướng chính',
  seeYourProfile: 'Xem trang cá nhân',
  logout: 'Đăng xuất',
  friends: 'Bạn bè',
  video: 'Video',
  saved: 'Đã lưu',
  memories: 'Kỷ niệm',
  pages: 'Trang',
  settingsPrivacy: 'Cài đặt & quyền riêng tư',
  seeMore: 'Xem thêm',
  seeLess: 'Thu gọn',
  footerLinks: 'Quyền riêng tư · Điều khoản · Quảng cáo · Lựa chọn quảng cáo · Cookie · Thêm · Fakebook © 2026',
  friendRequests: 'Lời mời kết bạn',
  postsLabel: 'bài viết',
  confirm: 'Xác nhận',
  delete: 'Xóa',
  sponsored: 'Tài trợ',
  birthdays: 'Sinh nhật',
  birthdayText: '<strong>{name}</strong> và <strong>{count} người khác</strong> có sinh nhật hôm nay.',
  contacts: 'Liên hệ',
  noContactsYet: 'Chưa có liên hệ.',
  editProfile: 'Chỉnh sửa hồ sơ',
  backToFeed: 'Về bảng tin',
  requestSent: 'Đã gửi lời mời',
  addFriend: 'Kết bạn',
  profileNoPosts: 'Chưa có bài viết',
  yourPostsEmpty: 'Bài viết của bạn sẽ hiển thị ở đây.',
  userPostsEmpty: '{name} chưa có bài viết bạn có thể xem.',
  nameRequired: 'Tên không được để trống.',
  saveProfileError: 'Không thể lưu hồ sơ.',
  editProfileTitle: 'Chỉnh sửa hồ sơ',
  avatarUrlLabel: 'URL ảnh đại diện',
  nameLabel: 'Tên',
  bioLabel: 'Tiểu sử',
  locationLabel: 'Vị trí',
  genderLabel: 'Giới tính',
  genderPreferNot: 'Không muốn chia sẻ',
  genderFemale: 'Nữ',
  genderMale: 'Nam',
  genderCustom: 'Khác',
  birthDateLabel: 'Ngày sinh',
  saving: 'Đang lưu…',
  saveChanges: 'Lưu thay đổi',
  loadFeedError: 'Không thể tải bảng tin.',
  genericError: 'Đã xảy ra lỗi.',
  tryAgain: 'Thử lại',
  yourFeedQuiet: 'Bảng tin của bạn đang yên ắng',
  feedQuietDesc: 'Hãy đăng bài đầu tiên hoặc thêm bạn bè để xem bài viết của họ.',
  loadingMore: 'Đang tải…',
  seeMorePosts: 'Xem thêm bài viết',
  storyCreate: 'Tạo tin',
  storyLabel: 'Tin của {name}',
  uploadFileError: 'Không thể tải tệp này lên.',
  composeNeedContent: 'Hãy viết gì đó hoặc thêm ảnh/video.',
  publishPostError: 'Không thể đăng bài viết.',
  composePrompt: 'Bạn đang nghĩ gì, {name}?',
  liveVideo: 'Video trực tiếp',
  photoVideo: 'Ảnh/video',
  feelingActivity: 'Cảm xúc/hoạt động',
  createPost: 'Tạo bài viết',
  privacyPublic: 'Công khai',
  privacyFriends: 'Bạn bè',
  privacyOnlyMe: 'Chỉ mình tôi',
  uploading: 'Đang tải lên…',
  removeMedia: 'Gỡ tệp phương tiện',
  addToPost: 'Thêm vào bài viết',
  addPhotoVideo: 'Thêm ảnh hoặc video',
  feeling: 'Cảm xúc',
  checkIn: 'Check-in',
  posting: 'Đang đăng…',
  post: 'Đăng',
  edited: 'Đã chỉnh sửa',
  postOptions: 'Tùy chọn bài viết',
  editPost: 'Chỉnh sửa bài viết',
  deletePost: 'Xóa bài viết',
  cancel: 'Hủy',
  save: 'Lưu',
  comment: 'bình luận',
  comments: 'bình luận',
  share: 'chia sẻ',
  shares: 'chia sẻ',
  like: 'Thích',
  love: 'Yêu thích',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Buồn',
  angry: 'Phẫn nộ',
  commentAction: 'Bình luận',
  shareAction: 'Chia sẻ',
  loadingComments: 'Đang tải bình luận…',
  noCommentsYet: 'Chưa có bình luận. Hãy là người đầu tiên.',
  writeComment: 'Viết bình luận…',
  sendComment: 'Gửi bình luận',
  sharePost: 'Chia sẻ bài viết',
  saySomethingAboutPost: 'Hãy nói gì đó về bài viết của {name}…',
  sharing: 'Đang chia sẻ…',
  shareNow: 'Chia sẻ ngay',
  deletePostConfirm: 'Xóa bài viết này? Hành động này không thể hoàn tác.',
  marketplace: 'Chợ',
  createNewListing: 'Tạo tin mới',
  searchMarketplace: 'Tìm trên Chợ',
  browseAll: 'Xem tất cả',
  yourListings: 'Tin của bạn',
  categories: 'Danh mục',
  allCategories: 'Tất cả danh mục',
  todaysPicks: 'Gợi ý hôm nay',
  noListingsYetMine: 'Bạn chưa có tin nào',
  noListingsYet: 'Chưa có dữ liệu',
  noListingsMineDesc: 'Hãy tạo tin để bắt đầu bán.',
  noListingsDesc: 'Hãy là người đầu tiên đăng bán.',
  auction: 'Đấu giá',
  ended: 'Đã kết thúc',
  localPickup: 'Nhận tại chỗ',
  bid: 'giá thầu',
  bids: 'giá thầu',
  listingUnavailable: 'Tin không khả dụng',
  backToMarketplace: 'Về Chợ',
  auctionEnded: 'Đấu giá đã kết thúc',
  listed: 'Đăng {time}',
  thisIsYourListing: 'Đây là tin của bạn.',
  deleteListing: 'Xóa tin',
  itemSold: 'Món hàng này đã được bán.',
  auctionEndedWinner: 'Đấu giá kết thúc. Người thắng: {name}.',
  auctionEndedNoBids: 'Đấu giá kết thúc mà không có giá thầu.',
  listingRemoved: 'Tin này đã bị gỡ.',
  yourBidMin: 'Giá thầu của bạn (tối thiểu {amount})',
  placeBid: 'Đặt giá',
  placingBid: 'Đang đặt giá…',
  highestBidder: 'Người trả giá cao nhất: {name}',
  buyNow: 'Mua ngay',
  processing: 'Đang xử lý…',
  seller: 'Người bán',
  description: 'Mô tả',
  bidHistory: 'Lịch sử trả giá',
  listingTitleRequired: 'Hãy nhập tiêu đề tin.',
  listingPriceInvalid: 'Hãy nhập giá hợp lệ.',
  createListingError: 'Không thể tạo tin.',
  createListingTitle: 'Tạo tin mới',
  fixedPrice: 'Giá cố định',
  title: 'Tiêu đề',
  price: 'Giá',
  startingBid: 'Giá khởi điểm',
  category: 'Danh mục',
  auctionLength: 'Thời lượng đấu giá',
  day: 'ngày',
  days: 'ngày',
  photoUrl: 'URL ảnh',
  publishListing: 'Đăng tin',
  publishing: 'Đang đăng…',
  loginIncorrect: 'Sai tên đăng nhập/email hoặc mật khẩu.',
  loginServerError: 'Không thể đăng nhập. Máy chủ đang chạy chứ?',
  loginPitch: 'Kết nối với bạn bè và thế giới xung quanh bạn trên Fakebook.',
  loginEmailOrUsername: 'Email hoặc tên đăng nhập',
  loginPassword: 'Mật khẩu',
  loginLoggingIn: 'Đang đăng nhập…',
  loginLogIn: 'Đăng nhập',
  forgottenPassword: 'Quên mật khẩu?',
  createAccount: 'Tạo tài khoản mới',
  demoAccount: 'Tài khoản demo: {username} / {password}',
  passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự.',
  usernameTaken: 'Tên đăng nhập hoặc email đã được sử dụng.',
  createAccountError: 'Không thể tạo tài khoản. Vui lòng thử lại.',
  signUp: 'Đăng ký',
  signupQuickEasy: 'Nhanh chóng và dễ dàng.',
  fullName: 'Họ và tên',
  username: 'Tên đăng nhập',
  emailAddress: 'Địa chỉ email',
  newPassword: 'Mật khẩu mới (ít nhất 6 ký tự)',
  creating: 'Đang tạo…',
  justNow: 'Vừa xong',
  minuteShort: '{count} phút',
  hourShort: '{count} giờ',
  dayShort: '{count} ngày',
  weekShort: '{count} tuần',
  endedShort: 'Đã kết thúc',
  leftShort: 'còn {value}',
}

function withFallback(overrides: Record<string, string>): Record<string, string> {
  return { ...en, ...overrides }
}

export const messages: Record<Locale, Record<string, string>> = {
  en,
  vi: withFallback(vi),
  ja: en,
  ko: en,
  'zh-CN': en,
  es: en,
  fr: en,
  de: en,
  pt: en,
  ru: en,
  it: en,
  id: en,
  th: en,
  hi: en,
  ar: en,
  tr: en,
  pl: en,
  nl: en,
}

export const languageOptions: { locale: Locale; label: string; shortLabel: string }[] = [
  { locale: 'en', label: 'English', shortLabel: 'EN' },
  { locale: 'vi', label: 'Tiếng Việt', shortLabel: 'VI' },
  { locale: 'ja', label: '日本語', shortLabel: 'JA' },
  { locale: 'ko', label: '한국어', shortLabel: 'KO' },
  { locale: 'zh-CN', label: '简体中文', shortLabel: 'ZH' },
  { locale: 'es', label: 'Español', shortLabel: 'ES' },
  { locale: 'fr', label: 'Français', shortLabel: 'FR' },
  { locale: 'de', label: 'Deutsch', shortLabel: 'DE' },
  { locale: 'pt', label: 'Português', shortLabel: 'PT' },
  { locale: 'ru', label: 'Русский', shortLabel: 'RU' },
  { locale: 'it', label: 'Italiano', shortLabel: 'IT' },
  { locale: 'id', label: 'Bahasa Indonesia', shortLabel: 'ID' },
  { locale: 'th', label: 'ไทย', shortLabel: 'TH' },
  { locale: 'hi', label: 'हिन्दी', shortLabel: 'HI' },
  { locale: 'ar', label: 'العربية', shortLabel: 'AR' },
  { locale: 'tr', label: 'Türkçe', shortLabel: 'TR' },
  { locale: 'pl', label: 'Polski', shortLabel: 'PL' },
  { locale: 'nl', label: 'Nederlands', shortLabel: 'NL' },
]

const localeValues = new Set(languageOptions.map((o) => o.locale))

export function isLocale(value: string | null): value is Locale {
  return !!value && localeValues.has(value as Locale)
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) {
      return stored
    }
  } catch {
    /* localStorage may be unavailable in private contexts */
  }

  const browserLocales = window.navigator.languages.length ? window.navigator.languages : [window.navigator.language]
  const found = browserLocales
    .map((value) => value.toLowerCase())
    .find((value) => languageOptions.some((opt) => value === opt.locale.toLowerCase() || value.startsWith(`${opt.locale.toLowerCase()}-`)))

  if (!found) return 'en'
  const option = languageOptions.find((opt) => found === opt.locale.toLowerCase() || found.startsWith(`${opt.locale.toLowerCase()}-`))
  return option?.locale ?? 'en'
}

export function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  function setLocale(next: Locale) {
    setLocaleState(next)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* ignore write failures */
    }
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => {
        const template = messages[locale][key] ?? en[key] ?? key
        return vars ? formatMessage(template, vars) : template
      },
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return value
}
