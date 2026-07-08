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
  footerLinks: 'Privacy Â· Terms Â· Advertising Â· Ad Choices Â· Cookies Â· More Â· Fakebook Â© 2026',
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
  saving: 'Savingâ€¦',
  saveChanges: 'Save changes',
  loadFeedError: 'Could not load your feed.',
  genericError: 'Something went wrong.',
  tryAgain: 'Try again',
  yourFeedQuiet: 'Your feed is quiet',
  feedQuietDesc: 'Share your first post, or add friends to see what they\'re posting.',
  loadingMore: 'Loadingâ€¦',
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
  uploading: 'Uploadingâ€¦',
  removeMedia: 'Remove media',
  addToPost: 'Add to your post',
  addPhotoVideo: 'Add photo or video',
  feeling: 'Feeling',
  checkIn: 'Check in',
  posting: 'Postingâ€¦',
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
  loadingComments: 'Loading commentsâ€¦',
  noCommentsYet: 'No comments yet. Be the first.',
  writeComment: 'Write a commentâ€¦',
  sendComment: 'Send comment',
  sharePost: 'Share post',
  saySomethingAboutPost: "Say something about {name}'s postâ€¦",
  sharing: 'Sharingâ€¦',
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
  placingBid: 'Placing bidâ€¦',
  highestBidder: 'Highest bidder: {name}',
  buyNow: 'Buy now',
  processing: 'Processingâ€¦',
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
  publishing: 'Publishingâ€¦',
  loginIncorrect: 'Incorrect username/email or password.',
  loginServerError: 'Could not log in. Is the server running?',
  loginPitch: 'Connect with friends and the world around you on Fakebook.',
  loginEmailOrUsername: 'Email or username',
  loginPassword: 'Password',
  loginLoggingIn: 'Logging inâ€¦',
  loginLogIn: 'Log in',
  forgottenPassword: 'Forgotten password?',
  createAccount: 'Create new account',
  demoAccount: 'Demo account: {username} / {password}',
  passwordTooShort: 'Password must be at least 8 characters.',
  usernameTaken: 'That username or email is already taken.',
  createAccountError: 'Could not create the account. Please try again.',
  signUp: 'Sign up',
  signupQuickEasy: "It's quick and easy.",
  fullName: 'Full name',
  username: 'Username',
  emailAddress: 'Email address',
  newPassword: 'New password (min 8 chars)',
  creating: 'Creatingâ€¦',
  verifyEmailTitle: 'Verify email',
  verifyEmailHelp: 'Enter the 6-digit code sent for this account.',
  verificationCode: 'Verification code',
  verifying: 'Verifying...',
  verifyEmailAction: 'Verify email',
  resendVerificationCode: 'Resend verification code',
  verifyEmailError: 'Could not verify that code.',
  resendVerificationError: 'Could not resend the verification code.',
  accountVerifiedTitle: 'Account verified',
  accountVerifiedHelp: 'You can now log in with your username or email.',
  justNow: 'Just now',
  minuteShort: '{count}m',
  hourShort: '{count}h',
  dayShort: '{count}d',
  weekShort: '{count}w',
  endedShort: 'Ended',
  leftShort: '{value} left',
}

const vi: Record<string, string> = {
  languageLabel: 'NgĂ´n ngá»¯',
  themeLabel: 'Giao diá»‡n',
  themeLight: 'SĂ¡ng',
  themeDark: 'Tá»‘i',
  gatewayError: 'MĂ¡y chá»§ táº¡m thá»i khĂ´ng truy cáº­p Ä‘Æ°á»£c.',
  dismissToast: 'ÄĂ³ng thĂ´ng bĂ¡o',
  searchPlaceholder: 'TĂ¬m kiáº¿m trĂªn Fakebook',
  home: 'Trang chá»§',
  watch: 'Video',
  groups: 'NhĂ³m',
  noPeopleFound: 'KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.',
  sent: 'ÄĂ£ gá»­i',
  add: 'ThĂªm',
  primaryNavLabel: 'Äiá»u hÆ°á»›ng chĂ­nh',
  seeYourProfile: 'Xem trang cĂ¡ nhĂ¢n',
  logout: 'ÄÄƒng xuáº¥t',
  friends: 'Báº¡n bĂ¨',
  video: 'Video',
  saved: 'ÄĂ£ lÆ°u',
  memories: 'Ká»· niá»‡m',
  pages: 'Trang',
  settingsPrivacy: 'CĂ i Ä‘áº·t & quyá»n riĂªng tÆ°',
  seeMore: 'Xem thĂªm',
  seeLess: 'Thu gá»n',
  footerLinks: 'Quyá»n riĂªng tÆ° Â· Äiá»u khoáº£n Â· Quáº£ng cĂ¡o Â· Lá»±a chá»n quáº£ng cĂ¡o Â· Cookie Â· ThĂªm Â· Fakebook Â© 2026',
  friendRequests: 'Lá»i má»i káº¿t báº¡n',
  postsLabel: 'bĂ i viáº¿t',
  confirm: 'XĂ¡c nháº­n',
  delete: 'XĂ³a',
  sponsored: 'TĂ i trá»£',
  birthdays: 'Sinh nháº­t',
  birthdayText: '<strong>{name}</strong> vĂ  <strong>{count} ngÆ°á»i khĂ¡c</strong> cĂ³ sinh nháº­t hĂ´m nay.',
  contacts: 'LiĂªn há»‡',
  noContactsYet: 'ChÆ°a cĂ³ liĂªn há»‡.',
  editProfile: 'Chá»‰nh sá»­a há»“ sÆ¡',
  backToFeed: 'Vá» báº£ng tin',
  requestSent: 'ÄĂ£ gá»­i lá»i má»i',
  addFriend: 'Káº¿t báº¡n',
  profileNoPosts: 'ChÆ°a cĂ³ bĂ i viáº¿t',
  yourPostsEmpty: 'BĂ i viáº¿t cá»§a báº¡n sáº½ hiá»ƒn thá»‹ á»Ÿ Ä‘Ă¢y.',
  userPostsEmpty: '{name} chÆ°a cĂ³ bĂ i viáº¿t báº¡n cĂ³ thá»ƒ xem.',
  nameRequired: 'TĂªn khĂ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.',
  saveProfileError: 'KhĂ´ng thá»ƒ lÆ°u há»“ sÆ¡.',
  editProfileTitle: 'Chá»‰nh sá»­a há»“ sÆ¡',
  avatarUrlLabel: 'URL áº£nh Ä‘áº¡i diá»‡n',
  nameLabel: 'TĂªn',
  bioLabel: 'Tiá»ƒu sá»­',
  locationLabel: 'Vá»‹ trĂ­',
  genderLabel: 'Giá»›i tĂ­nh',
  genderPreferNot: 'KhĂ´ng muá»‘n chia sáº»',
  genderFemale: 'Ná»¯',
  genderMale: 'Nam',
  genderCustom: 'KhĂ¡c',
  birthDateLabel: 'NgĂ y sinh',
  saving: 'Äang lÆ°uâ€¦',
  saveChanges: 'LÆ°u thay Ä‘á»•i',
  loadFeedError: 'KhĂ´ng thá»ƒ táº£i báº£ng tin.',
  genericError: 'ÄĂ£ xáº£y ra lá»—i.',
  tryAgain: 'Thá»­ láº¡i',
  yourFeedQuiet: 'Báº£ng tin cá»§a báº¡n Ä‘ang yĂªn áº¯ng',
  feedQuietDesc: 'HĂ£y Ä‘Äƒng bĂ i Ä‘áº§u tiĂªn hoáº·c thĂªm báº¡n bĂ¨ Ä‘á»ƒ xem bĂ i viáº¿t cá»§a há».',
  loadingMore: 'Äang táº£iâ€¦',
  seeMorePosts: 'Xem thĂªm bĂ i viáº¿t',
  storyCreate: 'Táº¡o tin',
  storyLabel: 'Tin cá»§a {name}',
  uploadFileError: 'KhĂ´ng thá»ƒ táº£i tá»‡p nĂ y lĂªn.',
  composeNeedContent: 'HĂ£y viáº¿t gĂ¬ Ä‘Ă³ hoáº·c thĂªm áº£nh/video.',
  publishPostError: 'KhĂ´ng thá»ƒ Ä‘Äƒng bĂ i viáº¿t.',
  composePrompt: 'Báº¡n Ä‘ang nghÄ© gĂ¬, {name}?',
  liveVideo: 'Video trá»±c tiáº¿p',
  photoVideo: 'áº¢nh/video',
  feelingActivity: 'Cáº£m xĂºc/hoáº¡t Ä‘á»™ng',
  createPost: 'Táº¡o bĂ i viáº¿t',
  privacyPublic: 'CĂ´ng khai',
  privacyFriends: 'Báº¡n bĂ¨',
  privacyOnlyMe: 'Chá»‰ mĂ¬nh tĂ´i',
  uploading: 'Äang táº£i lĂªnâ€¦',
  removeMedia: 'Gá»¡ tá»‡p phÆ°Æ¡ng tiá»‡n',
  addToPost: 'ThĂªm vĂ o bĂ i viáº¿t',
  addPhotoVideo: 'ThĂªm áº£nh hoáº·c video',
  feeling: 'Cáº£m xĂºc',
  checkIn: 'Check-in',
  posting: 'Äang Ä‘Äƒngâ€¦',
  post: 'ÄÄƒng',
  edited: 'ÄĂ£ chá»‰nh sá»­a',
  postOptions: 'TĂ¹y chá»n bĂ i viáº¿t',
  editPost: 'Chá»‰nh sá»­a bĂ i viáº¿t',
  deletePost: 'XĂ³a bĂ i viáº¿t',
  cancel: 'Há»§y',
  save: 'LÆ°u',
  comment: 'bĂ¬nh luáº­n',
  comments: 'bĂ¬nh luáº­n',
  share: 'chia sáº»',
  shares: 'chia sáº»',
  like: 'ThĂ­ch',
  love: 'YĂªu thĂ­ch',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Buá»“n',
  angry: 'Pháº«n ná»™',
  commentAction: 'BĂ¬nh luáº­n',
  shareAction: 'Chia sáº»',
  loadingComments: 'Äang táº£i bĂ¬nh luáº­nâ€¦',
  noCommentsYet: 'ChÆ°a cĂ³ bĂ¬nh luáº­n. HĂ£y lĂ  ngÆ°á»i Ä‘áº§u tiĂªn.',
  writeComment: 'Viáº¿t bĂ¬nh luáº­nâ€¦',
  sendComment: 'Gá»­i bĂ¬nh luáº­n',
  sharePost: 'Chia sáº» bĂ i viáº¿t',
  saySomethingAboutPost: 'HĂ£y nĂ³i gĂ¬ Ä‘Ă³ vá» bĂ i viáº¿t cá»§a {name}â€¦',
  sharing: 'Äang chia sáº»â€¦',
  shareNow: 'Chia sáº» ngay',
  deletePostConfirm: 'XĂ³a bĂ i viáº¿t nĂ y? HĂ nh Ä‘á»™ng nĂ y khĂ´ng thá»ƒ hoĂ n tĂ¡c.',
  marketplace: 'Chá»£',
  createNewListing: 'Táº¡o tin má»›i',
  searchMarketplace: 'TĂ¬m trĂªn Chá»£',
  browseAll: 'Xem táº¥t cáº£',
  yourListings: 'Tin cá»§a báº¡n',
  categories: 'Danh má»¥c',
  allCategories: 'Táº¥t cáº£ danh má»¥c',
  todaysPicks: 'Gá»£i Ă½ hĂ´m nay',
  noListingsYetMine: 'Báº¡n chÆ°a cĂ³ tin nĂ o',
  noListingsYet: 'ChÆ°a cĂ³ dá»¯ liá»‡u',
  noListingsMineDesc: 'HĂ£y táº¡o tin Ä‘á»ƒ báº¯t Ä‘áº§u bĂ¡n.',
  noListingsDesc: 'HĂ£y lĂ  ngÆ°á»i Ä‘áº§u tiĂªn Ä‘Äƒng bĂ¡n.',
  auction: 'Äáº¥u giĂ¡',
  ended: 'ÄĂ£ káº¿t thĂºc',
  localPickup: 'Nháº­n táº¡i chá»—',
  bid: 'giĂ¡ tháº§u',
  bids: 'giĂ¡ tháº§u',
  listingUnavailable: 'Tin khĂ´ng kháº£ dá»¥ng',
  backToMarketplace: 'Vá» Chá»£',
  auctionEnded: 'Äáº¥u giĂ¡ Ä‘Ă£ káº¿t thĂºc',
  listed: 'ÄÄƒng {time}',
  thisIsYourListing: 'ÄĂ¢y lĂ  tin cá»§a báº¡n.',
  deleteListing: 'XĂ³a tin',
  itemSold: 'MĂ³n hĂ ng nĂ y Ä‘Ă£ Ä‘Æ°á»£c bĂ¡n.',
  auctionEndedWinner: 'Äáº¥u giĂ¡ káº¿t thĂºc. NgÆ°á»i tháº¯ng: {name}.',
  auctionEndedNoBids: 'Äáº¥u giĂ¡ káº¿t thĂºc mĂ  khĂ´ng cĂ³ giĂ¡ tháº§u.',
  listingRemoved: 'Tin nĂ y Ä‘Ă£ bá»‹ gá»¡.',
  yourBidMin: 'GiĂ¡ tháº§u cá»§a báº¡n (tá»‘i thiá»ƒu {amount})',
  placeBid: 'Äáº·t giĂ¡',
  placingBid: 'Äang Ä‘áº·t giĂ¡â€¦',
  highestBidder: 'NgÆ°á»i tráº£ giĂ¡ cao nháº¥t: {name}',
  buyNow: 'Mua ngay',
  processing: 'Äang xá»­ lĂ½â€¦',
  seller: 'NgÆ°á»i bĂ¡n',
  description: 'MĂ´ táº£',
  bidHistory: 'Lá»‹ch sá»­ tráº£ giĂ¡',
  listingTitleRequired: 'HĂ£y nháº­p tiĂªu Ä‘á» tin.',
  listingPriceInvalid: 'HĂ£y nháº­p giĂ¡ há»£p lá»‡.',
  createListingError: 'KhĂ´ng thá»ƒ táº¡o tin.',
  createListingTitle: 'Táº¡o tin má»›i',
  fixedPrice: 'GiĂ¡ cá»‘ Ä‘á»‹nh',
  title: 'TiĂªu Ä‘á»',
  price: 'GiĂ¡',
  startingBid: 'GiĂ¡ khá»Ÿi Ä‘iá»ƒm',
  category: 'Danh má»¥c',
  auctionLength: 'Thá»i lÆ°á»£ng Ä‘áº¥u giĂ¡',
  day: 'ngĂ y',
  days: 'ngĂ y',
  photoUrl: 'URL áº£nh',
  publishListing: 'ÄÄƒng tin',
  publishing: 'Äang Ä‘Äƒngâ€¦',
  loginIncorrect: 'Sai tĂªn Ä‘Äƒng nháº­p/email hoáº·c máº­t kháº©u.',
  loginServerError: 'KhĂ´ng thá»ƒ Ä‘Äƒng nháº­p. MĂ¡y chá»§ Ä‘ang cháº¡y chá»©?',
  loginPitch: 'Káº¿t ná»‘i vá»›i báº¡n bĂ¨ vĂ  tháº¿ giá»›i xung quanh báº¡n trĂªn Fakebook.',
  loginEmailOrUsername: 'Email hoáº·c tĂªn Ä‘Äƒng nháº­p',
  loginPassword: 'Máº­t kháº©u',
  loginLoggingIn: 'Äang Ä‘Äƒng nháº­pâ€¦',
  loginLogIn: 'ÄÄƒng nháº­p',
  forgottenPassword: 'QuĂªn máº­t kháº©u?',
  createAccount: 'Táº¡o tĂ i khoáº£n má»›i',
  demoAccount: 'TĂ i khoáº£n demo: {username} / {password}',
  passwordTooShort: 'Máº­t kháº©u pháº£i cĂ³ Ă­t nháº¥t 8 kĂ½ tá»±.',
  usernameTaken: 'TĂªn Ä‘Äƒng nháº­p hoáº·c email Ä‘Ă£ Ä‘Æ°á»£c sá»­ dá»¥ng.',
  createAccountError: 'KhĂ´ng thá»ƒ táº¡o tĂ i khoáº£n. Vui lĂ²ng thá»­ láº¡i.',
  signUp: 'ÄÄƒng kĂ½',
  signupQuickEasy: 'Nhanh chĂ³ng vĂ  dá»… dĂ ng.',
  fullName: 'Há» vĂ  tĂªn',
  username: 'TĂªn Ä‘Äƒng nháº­p',
  emailAddress: 'Äá»‹a chá»‰ email',
  newPassword: 'Máº­t kháº©u má»›i (Ă­t nháº¥t 8 kĂ½ tá»±)',
  creating: 'Äang táº¡oâ€¦',
  justNow: 'Vá»«a xong',
  minuteShort: '{count} phĂºt',
  hourShort: '{count} giá»',
  dayShort: '{count} ngĂ y',
  weekShort: '{count} tuáº§n',
  endedShort: 'ÄĂ£ káº¿t thĂºc',
  leftShort: 'cĂ²n {value}',
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
  { locale: 'vi', label: 'Tiáº¿ng Viá»‡t', shortLabel: 'VI' },
  { locale: 'ja', label: 'æ—¥æœ¬èª', shortLabel: 'JA' },
  { locale: 'ko', label: 'í•œêµ­́–´', shortLabel: 'KO' },
  { locale: 'zh-CN', label: 'ç®€ä½“ä¸­æ–‡', shortLabel: 'ZH' },
  { locale: 'es', label: 'EspaĂ±ol', shortLabel: 'ES' },
  { locale: 'fr', label: 'FranĂ§ais', shortLabel: 'FR' },
  { locale: 'de', label: 'Deutsch', shortLabel: 'DE' },
  { locale: 'pt', label: 'PortuguĂªs', shortLabel: 'PT' },
  { locale: 'ru', label: 'Đ ÑƒÑÑĐºĐ¸Đ¹', shortLabel: 'RU' },
  { locale: 'it', label: 'Italiano', shortLabel: 'IT' },
  { locale: 'id', label: 'Bahasa Indonesia', shortLabel: 'ID' },
  { locale: 'th', label: 'à¹„à¸—à¸¢', shortLabel: 'TH' },
  { locale: 'hi', label: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€', shortLabel: 'HI' },
  { locale: 'ar', label: 'Ø§Ù„Ø¹Ø±Ø¨ÙØ©', shortLabel: 'AR' },
  { locale: 'tr', label: 'TĂ¼rkĂ§e', shortLabel: 'TR' },
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
