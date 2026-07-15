import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
const IP_GEOLOCATION_URL = import.meta.env.VITE_IP_GEOLOCATION_URL?.trim() || 'https://ipwho.is/'

const en: Record<string, string> = {
  languageLabel: 'Language',
  themeLabel: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  gatewayError: 'Server is temporarily unreachable.',
  dismissToast: 'Dismiss notification',
  searchPlaceholder: 'Search Fakebook',
  home: 'Home',
  premium: 'Premium',
  security: 'Security',
  appNavigation: 'Application navigation',
  loggedInAs: 'Signed in as {email}',
  recommendedFeed: 'Recommended for you',
  recommendedFeedSubtitle: 'Posts ranked by Recommendation and hydrated by SocialGraph.',
  noRecommendedPosts: 'No recommended posts yet',
  noRecommendedPostsDesc: 'New public posts will appear here when Recommendation has candidates for you.',
  feedLoadError: 'The recommended feed could not be loaded.',
  loadMorePosts: 'Load more posts',
  endOfFeed: 'You are all caught up.',
  groupPostLabel: 'Post in {group}',
  verifiedAccount: 'Verified account',
  publishPostSuccess: 'Your post was published.',
  postComposerPlaceholder: 'Share something with your community…',
  stories: 'Stories',
  storiesSubtitle: 'Recent stories from SocialGraph.',
  storiesLoadError: 'Stories could not be loaded.',
  noStories: 'No stories are available yet.',
  storyPrompt: 'Share a short update…',
  storyPublished: 'Your story was published.',
  storyPublishError: 'The story could not be published.',
  deleteStory: 'Delete story',
  storyDeleted: 'Story deleted.',
  visitedGroups: 'Recently visited groups',
  visitedGroupsSubtitle: 'Shortcuts saved by SocialGraph.',
  noVisitedGroups: 'No visited groups yet.',
  groupVisitRecorded: 'Opened {group} and refreshed its shortcut.',
  serviceDataNote: 'Only features exposed by the API Gateway are shown.',
  premiumTitle: 'Fakebook Premium',
  premiumSubtitle: 'Choose a plan and complete payment securely through PayOS.',
  premiumCurrentStatus: 'Current premium status',
  premiumActiveUntil: 'Active until {date}',
  premiumInactive: 'Premium is not active on this account.',
  premiumPlansLoadError: 'Premium plans could not be loaded.',
  premiumOrderLoadError: 'Payment status could not be loaded.',
  choosePremiumPlan: 'Choose your plan',
  monthlyPlan: 'Monthly',
  yearlyPlan: 'Yearly',
  planDuration: '{count} month(s)',
  startCheckout: 'Continue to payment',
  creatingCheckout: 'Creating checkout…',
  checkoutRedirectNote: 'You will be sent to a secure external payment page.',
  pendingOrder: 'Pending payment',
  orderCode: 'Order code',
  paymentStatus: 'Status',
  refreshPaymentStatus: 'Refresh payment status',
  checkingPayment: 'Checking…',
  paymentStatusCREATED: 'Created',
  paymentStatusPENDING: 'Waiting for payment',
  paymentStatusPAID: 'Paid',
  paymentStatusACTIVATION_PENDING: 'Activating Premium',
  paymentStatusACTIVATED: 'Premium activated',
  paymentStatusCANCELLED: 'Cancelled',
  paymentStatusEXPIRED: 'Expired',
  paymentStatusFAILED: 'Failed',
  paymentActivated: 'Premium has been activated on your account.',
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
  loginIncorrect: 'Incorrect email or password.',
  loginServerError: 'Could not log in. Is the server running?',
  loginPitch: 'Connect with friends and the world around you on Fakebook.',
  loginPassword: 'Password',
  loginLoggingIn: 'Logging in…',
  loginLogIn: 'Log in',
  forgottenPassword: 'Forgotten password?',
  createAccount: 'Create new account',
  passwordMinimum: 'Password must be at least 8 characters.',
  emailTaken: 'That email address is already registered.',
  createAccountError: 'Could not create the account. Please try again.',
  signUp: 'Sign up',
  signupProfileNote: 'Create your identity and SocialGraph profile.',
  fullName: 'Full name',
  emailAddress: 'Email address',
  newPassword: 'New password (minimum 8 characters)',
  creating: 'Creating…',
  close: 'Close',
  selectGender: 'Select gender',
  genderRequired: 'Select a gender.',
  profileDataOwnedBySocialGraph: 'Name, gender, birth date, and location are stored by SocialGraph, not Authentication.',
  emailNeedsVerification: 'Verify your email before logging in.',
  verifyEmailNow: 'Verify email',
  verifyYourEmail: 'Verify your email',
  emailConfirmation: 'Email confirmation',
  securityCheck: 'Security check',
  confirmItsYou: "Confirm that it's you",
  backToLogin: 'Back to login',
  enterEmailCode: 'Enter your email code',
  emailCodeHelp: 'Use the one-time code from your verification email.',
  enterLoginCode: 'Enter your login code',
  twoFactorIntro: 'Your account has two-factor authentication enabled, so this extra login step is required.',
  twoFactorCodeHelp: 'Enter the 6-digit code from your authenticator app or verification message.',
  submitCode: 'Submit code',
  needAnotherWay: 'Need another way to confirm that it is you?',
  twoFactorAlternativeHelp: 'Use a backup code or another configured authentication method.',
  twoFactorBackendUnavailable: 'The 2FA verification API is not available in the current Authentication service.',
  verificationSentTo: 'Enter the verification code sent to {email}.',
  verificationCode: 'Verification code',
  verifying: 'Verifying…',
  verificationError: 'The verification code is invalid or expired.',
  verificationCodeResent: 'A new verification code was sent.',
  resendCode: 'Resend code',
  resendError: 'A new code could not be sent yet. Please try again later.',
  emailVerified: 'Your email has been verified. You can now log in.',
  continueToLogin: 'Continue to login',
  resetPassword: 'Reset password',
  resetPasswordIntro: 'Enter your account email to receive a password reset code.',
  sendResetCode: 'Send reset code',
  sending: 'Sending…',
  resetCodeSentTo: 'Enter the reset code sent to {email}.',
  passwordResetRequestError: 'The reset request could not be completed. Please try again later.',
  passwordResetError: 'The code is invalid or expired, or the password could not be changed.',
  passwordResetComplete: 'Your password has been reset. You can now log in.',
  newPasswordLabel: 'New password',
  confirmPassword: 'Confirm new password',
  passwordMismatch: 'The new passwords do not match.',
  accountSecurity: 'Account security',
  welcomeEmail: 'Welcome, {email}',
  authReadyMessage: 'Authentication is connected through the API Gateway. Manage your credentials and active sessions here.',
  accountStatus: 'Account status',
  accountActive: 'Active',
  accountPending: 'Pending verification',
  userId: 'User ID',
  premiumUntil: 'Premium until',
  notActive: 'Not active',
  activeSessions: 'Active sessions',
  activeSessionsHelp: 'Review devices that currently have access to your account.',
  refresh: 'Refresh',
  sessionsLoadError: 'Sessions could not be loaded.',
  sessionRevokeError: 'That session could not be revoked.',
  noSessions: 'No active sessions were returned.',
  unknownDevice: 'Unknown device',
  unknown: 'Unknown',
  lastSeen: 'Last seen',
  logoutThisDevice: 'Log out',
  revoke: 'Revoke',
  logoutAllDevices: 'Log out of all devices',
  changePassword: 'Change password',
  changePasswordHelp: 'Changing your password revokes your other active sessions.',
  currentPassword: 'Current password',
  currentPasswordIncorrect: 'The current password is incorrect.',
  passwordChangeError: 'The password could not be changed.',
  passwordChanged: 'Password changed successfully.',
  sessionHistory: 'Session history',
  sessionHistoryHelp: 'Recently expired or revoked sessions.',
  noSessionHistory: 'No previous sessions were returned.',
  expired: 'Expired',
  justNow: 'Just now',
  minuteShort: '{count}m',
  hourShort: '{count}h',
  dayShort: '{count}d',
  weekShort: '{count}w',
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
  premium: 'Premium',
  security: 'Bảo mật',
  appNavigation: 'Điều hướng ứng dụng',
  loggedInAs: 'Đã đăng nhập bằng {email}',
  recommendedFeed: 'Dành cho bạn',
  recommendedFeedSubtitle: 'Bài viết được Recommendation xếp hạng và SocialGraph cung cấp dữ liệu.',
  noRecommendedPosts: 'Chưa có bài viết đề xuất',
  noRecommendedPostsDesc: 'Bài viết công khai mới sẽ xuất hiện khi Recommendation có nội dung phù hợp.',
  feedLoadError: 'Không thể tải bảng tin đề xuất.',
  loadMorePosts: 'Tải thêm bài viết',
  endOfFeed: 'Bạn đã xem hết nội dung hiện có.',
  groupPostLabel: 'Bài viết trong {group}',
  verifiedAccount: 'Tài khoản đã xác minh',
  publishPostSuccess: 'Bài viết đã được đăng.',
  postComposerPlaceholder: 'Chia sẻ điều gì đó với cộng đồng…',
  stories: 'Tin',
  storiesSubtitle: 'Tin gần đây từ SocialGraph.',
  storiesLoadError: 'Không thể tải tin.',
  noStories: 'Chưa có tin nào.',
  storyPrompt: 'Chia sẻ một cập nhật ngắn…',
  storyPublished: 'Tin của bạn đã được đăng.',
  storyPublishError: 'Không thể đăng tin.',
  deleteStory: 'Xóa tin',
  storyDeleted: 'Đã xóa tin.',
  visitedGroups: 'Nhóm đã truy cập gần đây',
  visitedGroupsSubtitle: 'Lối tắt được SocialGraph lưu lại.',
  noVisitedGroups: 'Bạn chưa truy cập nhóm nào.',
  groupVisitRecorded: 'Đã mở {group} và cập nhật lối tắt.',
  serviceDataNote: 'Chỉ hiển thị các tính năng đã được API Gateway công khai.',
  premiumTitle: 'Fakebook Premium',
  premiumSubtitle: 'Chọn gói và thanh toán an toàn qua PayOS.',
  premiumCurrentStatus: 'Trạng thái Premium hiện tại',
  premiumActiveUntil: 'Có hiệu lực đến {date}',
  premiumInactive: 'Tài khoản này chưa kích hoạt Premium.',
  premiumPlansLoadError: 'Không thể tải các gói Premium.',
  premiumOrderLoadError: 'Không thể tải trạng thái thanh toán.',
  choosePremiumPlan: 'Chọn gói của bạn',
  monthlyPlan: 'Hàng tháng',
  yearlyPlan: 'Hàng năm',
  planDuration: '{count} tháng',
  startCheckout: 'Tiếp tục thanh toán',
  creatingCheckout: 'Đang tạo phiên thanh toán…',
  checkoutRedirectNote: 'Bạn sẽ được chuyển đến trang thanh toán bảo mật bên ngoài.',
  pendingOrder: 'Thanh toán đang chờ',
  orderCode: 'Mã đơn hàng',
  paymentStatus: 'Trạng thái',
  refreshPaymentStatus: 'Làm mới trạng thái',
  checkingPayment: 'Đang kiểm tra…',
  paymentStatusCREATED: 'Đã tạo',
  paymentStatusPENDING: 'Chờ thanh toán',
  paymentStatusPAID: 'Đã thanh toán',
  paymentStatusACTIVATION_PENDING: 'Đang kích hoạt Premium',
  paymentStatusACTIVATED: 'Đã kích hoạt Premium',
  paymentStatusCANCELLED: 'Đã hủy',
  paymentStatusEXPIRED: 'Đã hết hạn',
  paymentStatusFAILED: 'Thất bại',
  paymentActivated: 'Premium đã được kích hoạt cho tài khoản của bạn.',
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
  loginIncorrect: 'Email hoặc mật khẩu không đúng.',
  loginServerError: 'Không thể đăng nhập. Vui lòng thử lại sau.',
  loginPitch: 'Kết nối với bạn bè và thế giới xung quanh bạn trên Fakebook.',
  loginPassword: 'Mật khẩu',
  loginLoggingIn: 'Đang đăng nhập…',
  loginLogIn: 'Đăng nhập',
  forgottenPassword: 'Quên mật khẩu?',
  createAccount: 'Tạo tài khoản mới',
  passwordMinimum: 'Mật khẩu phải có ít nhất 8 ký tự.',
  emailTaken: 'Địa chỉ email này đã được đăng ký.',
  createAccountError: 'Không thể tạo tài khoản. Vui lòng thử lại.',
  signUp: 'Đăng ký',
  signupProfileNote: 'Tạo danh tính và hồ sơ SocialGraph của bạn.',
  fullName: 'Họ và tên',
  emailAddress: 'Địa chỉ email',
  newPassword: 'Mật khẩu mới (ít nhất 8 ký tự)',
  creating: 'Đang tạo…',
  close: 'Đóng',
  selectGender: 'Chọn giới tính',
  genderRequired: 'Vui lòng chọn giới tính.',
  profileDataOwnedBySocialGraph: 'Tên, giới tính, ngày sinh và vị trí được lưu bởi SocialGraph, không thuộc Authentication.',
  emailNeedsVerification: 'Hãy xác minh email trước khi đăng nhập.',
  verifyEmailNow: 'Xác minh email',
  verifyYourEmail: 'Xác minh email của bạn',
  emailConfirmation: 'Xác nhận email',
  securityCheck: 'Kiểm tra bảo mật',
  confirmItsYou: 'Xác nhận đây là bạn',
  backToLogin: 'Quay lại đăng nhập',
  enterEmailCode: 'Nhập mã email',
  emailCodeHelp: 'Sử dụng mã dùng một lần trong email xác minh.',
  enterLoginCode: 'Nhập mã đăng nhập',
  twoFactorIntro: 'Tài khoản đã bật xác thực hai yếu tố nên cần thêm bước đăng nhập này.',
  twoFactorCodeHelp: 'Nhập mã 6 chữ số từ ứng dụng xác thực hoặc tin nhắn xác minh.',
  submitCode: 'Gửi mã',
  needAnotherWay: 'Bạn cần cách khác để xác nhận danh tính?',
  twoFactorAlternativeHelp: 'Sử dụng mã dự phòng hoặc phương thức xác thực khác đã cấu hình.',
  twoFactorBackendUnavailable: 'Dịch vụ Authentication hiện chưa cung cấp API xác minh 2FA.',
  verificationSentTo: 'Nhập mã xác minh đã gửi đến {email}.',
  verificationCode: 'Mã xác minh',
  verifying: 'Đang xác minh…',
  verificationError: 'Mã xác minh không đúng hoặc đã hết hạn.',
  verificationCodeResent: 'Mã xác minh mới đã được gửi.',
  resendCode: 'Gửi lại mã',
  resendError: 'Chưa thể gửi mã mới. Vui lòng thử lại sau.',
  emailVerified: 'Email đã được xác minh. Bạn có thể đăng nhập.',
  continueToLogin: 'Tiếp tục đăng nhập',
  resetPassword: 'Đặt lại mật khẩu',
  resetPasswordIntro: 'Nhập email tài khoản để nhận mã đặt lại mật khẩu.',
  sendResetCode: 'Gửi mã đặt lại',
  sending: 'Đang gửi…',
  resetCodeSentTo: 'Nhập mã đặt lại đã gửi đến {email}.',
  passwordResetRequestError: 'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.',
  passwordResetError: 'Mã không đúng, đã hết hạn hoặc không thể đổi mật khẩu.',
  passwordResetComplete: 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.',
  newPasswordLabel: 'Mật khẩu mới',
  confirmPassword: 'Xác nhận mật khẩu mới',
  passwordMismatch: 'Hai mật khẩu mới không khớp.',
  accountSecurity: 'Bảo mật tài khoản',
  welcomeEmail: 'Xin chào, {email}',
  authReadyMessage: 'Authentication đã kết nối qua API Gateway. Quản lý thông tin đăng nhập và các phiên hoạt động tại đây.',
  accountStatus: 'Trạng thái tài khoản',
  accountActive: 'Đang hoạt động',
  accountPending: 'Chờ xác minh',
  userId: 'Mã người dùng',
  premiumUntil: 'Premium đến',
  notActive: 'Chưa kích hoạt',
  activeSessions: 'Phiên đang hoạt động',
  activeSessionsHelp: 'Kiểm tra các thiết bị hiện có quyền truy cập tài khoản.',
  refresh: 'Làm mới',
  sessionsLoadError: 'Không thể tải danh sách phiên.',
  sessionRevokeError: 'Không thể thu hồi phiên này.',
  noSessions: 'Không có phiên hoạt động.',
  unknownDevice: 'Thiết bị không xác định',
  unknown: 'Không xác định',
  lastSeen: 'Hoạt động gần nhất',
  logoutThisDevice: 'Đăng xuất',
  revoke: 'Thu hồi',
  logoutAllDevices: 'Đăng xuất khỏi mọi thiết bị',
  changePassword: 'Đổi mật khẩu',
  changePasswordHelp: 'Đổi mật khẩu sẽ thu hồi các phiên đang hoạt động khác.',
  currentPassword: 'Mật khẩu hiện tại',
  currentPasswordIncorrect: 'Mật khẩu hiện tại không đúng.',
  passwordChangeError: 'Không thể đổi mật khẩu.',
  passwordChanged: 'Đổi mật khẩu thành công.',
  sessionHistory: 'Lịch sử phiên',
  sessionHistoryHelp: 'Các phiên đã hết hạn hoặc bị thu hồi gần đây.',
  noSessionHistory: 'Chưa có lịch sử phiên.',
  expired: 'Đã hết hạn',
  justNow: 'Vừa xong',
  minuteShort: '{count} phút',
  hourShort: '{count} giờ',
  dayShort: '{count} ngày',
  weekShort: '{count} tuần',
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

const countryLocales: Partial<Record<string, Locale>> = {
  VN: 'vi',
  JP: 'ja',
  KR: 'ko',
  CN: 'zh-CN',
  HK: 'zh-CN',
  TW: 'zh-CN',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  FR: 'fr',
  BE: 'fr',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  PT: 'pt',
  BR: 'pt',
  RU: 'ru',
  IT: 'it',
  ID: 'id',
  TH: 'th',
  IN: 'hi',
  TR: 'tr',
  PL: 'pl',
  NL: 'nl',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  QA: 'ar',
  KW: 'ar',
  MA: 'ar',
}

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
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

  useEffect(() => {
    if (readStoredLocale()) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 4000)
    fetch(IP_GEOLOCATION_URL, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('IP locale lookup failed')
        return response.json() as Promise<{ success?: boolean; country_code?: string }>
      })
      .then((result) => {
        if (result.success === false || readStoredLocale()) return
        const detected = countryLocales[result.country_code?.toUpperCase() ?? '']
        if (detected) setLocaleState(detected)
      })
      .catch(() => {
        /* Browser locale selected by getInitialLocale remains the fallback. */
      })
      .finally(() => window.clearTimeout(timeoutId))

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

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
