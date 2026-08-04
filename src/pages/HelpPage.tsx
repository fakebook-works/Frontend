import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Locale } from '../i18n'
import {
  FaUser,
  FaUsers,
  FaHome,
  FaComments,
  FaVideo,
  FaBookOpen,
  FaImage,
  FaGamepad,
  FaShieldAlt,
  FaCog,
  FaExclamationTriangle,
  FaSearch,
  FaChevronDown,
  FaChevronRight,
  FaKey,
  FaUserShield,
  FaFlag,
  FaFileAlt,
  FaLink,
} from 'react-icons/fa'
import './HelpPage.css'

export interface HelpPageProps {
  onBack?: () => void
  initialTopic?: string
}

type ViewMode = 'home' | 'category' | 'detail'

interface NavItem {
  key: string
  labelVi: string
  labelEn: string
  icon: React.ReactNode
  color: string
  children?: NavItem[]
}

interface Article {
  id: string
  titleVi: string
  titleEn: string
  contentVi: React.ReactNode
  contentEn: React.ReactNode
  section?: string
}

interface Section {
  key: string
  titleVi: string
  titleEn: string
}

interface CategoryContent {
  bannerDescVi: string
  bannerDescEn: string
  quickActions: { labelVi: string; labelEn: string }[]
  articles: Article[]
  popularArticles: { labelVi: string; labelEn: string }[]
  sections?: Section[]
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'using-facebook',
    labelVi: 'Sử dụng Fakebook',
    labelEn: 'Using Fakebook',
    icon: <FaLink />,
    color: '#1877f2',
    children: [
      {
        key: 'creating-account',
        labelVi: 'Tạo tài khoản',
        labelEn: 'Creating an account',
        icon: <FaUser />,
        color: '#1877f2',
      },
      {
        key: 'your-profile',
        labelVi: 'Trang cá nhân của bạn',
        labelEn: 'Your profile',
        icon: <FaUser />,
        color: '#1877f2',
        children: [
          {
            key: 'edit-profile-info',
            labelVi: 'Thêm và chỉnh sửa thông tin trang cá nhân',
            labelEn: 'Add and edit your profile info',
            icon: <FaUser />,
            color: '#1877f2',
          },
          {
            key: 'profile-cover-photo',
            labelVi: 'Ảnh đại diện và ảnh bìa',
            labelEn: 'Your profile picture and cover photo',
            icon: <FaImage />,
            color: '#1877f2',
          },
          {
            key: 'share-manage-posts',
            labelVi: 'Chia sẻ và quản lý bài viết trên trang cá nhân',
            labelEn: 'Share and manage posts on your profile',
            icon: <FaComments />,
            color: '#1877f2',
          },
          {
            key: 'fix-problem',
            labelVi: 'Sửa lỗi',
            labelEn: 'Fix a problem',
            icon: <FaExclamationTriangle />,
            color: '#1877f2',
          },
        ],
      },
      {
        key: 'friending',
        labelVi: 'Kết bạn',
        labelEn: 'Friending',
        icon: <FaUsers />,
        color: '#1877f2',
      },
      {
        key: 'your-home-page',
        labelVi: 'Trang chủ của bạn',
        labelEn: 'Your home page',
        icon: <FaHome />,
        color: '#1877f2',
      },
      {
        key: 'messaging',
        labelVi: 'Nhắn tin',
        labelEn: 'Messaging',
        icon: <FaComments />,
        color: '#1877f2',
      },
      {
        key: 'reels',
        labelVi: 'Reels',
        labelEn: 'Reels',
        icon: <FaVideo />,
        color: '#1877f2',
      },
      {
        key: 'stories',
        labelVi: 'Tin',
        labelEn: 'Stories',
        icon: <FaBookOpen />,
        color: '#1877f2',
      },
      {
        key: 'photos',
        labelVi: 'Ảnh',
        labelEn: 'Photos',
        icon: <FaImage />,
        color: '#1877f2',
      },
      {
        key: 'videos',
        labelVi: 'Video',
        labelEn: 'Videos',
        icon: <FaVideo />,
        color: '#1877f2',
      },
      {
        key: 'gaming',
        labelVi: 'Trò chơi',
        labelEn: 'Gaming',
        icon: <FaGamepad />,
        color: '#1877f2',
      },
    ],
  },
  {
    key: 'login-recovery-security',
    labelVi: 'Đăng nhập, khôi phục và bảo mật',
    labelEn: 'Login, recovery and security',
    icon: <FaKey />,
    color: '#00a651',
    children: [
      {
        key: 'login-password',
        labelVi: 'Đăng nhập và mật khẩu',
        labelEn: 'Login and password',
        icon: <FaKey />,
        color: '#00a651',
      },
      {
        key: 'account-security',
        labelVi: 'Bảo mật tài khoản',
        labelEn: 'Account security',
        icon: <FaShieldAlt />,
        color: '#00a651',
      },
      {
        key: 'login-trouble',
        labelVi: 'Đăng nhập gặp sự cố',
        labelEn: 'Trouble logging in',
        icon: <FaExclamationTriangle />,
        color: '#00a651',
      },
    ],
  },
  {
    key: 'managing-account',
    labelVi: 'Quản lý tài khoản',
    labelEn: 'Managing your account',
    icon: <FaCog />,
    color: '#f57c00',
    children: [
      {
        key: 'account-settings',
        labelVi: 'Cài đặt tài khoản',
        labelEn: 'Account settings',
        icon: <FaCog />,
        color: '#f57c00',
      },
      {
        key: 'preferences',
        labelVi: 'Tùy chọn',
        labelEn: 'Preferences',
        icon: <FaCog />,
        color: '#f57c00',
      },
      {
        key: 'notifications',
        labelVi: 'Thông báo',
        labelEn: 'Notifications',
        icon: <FaCog />,
        color: '#f57c00',
      },
    ],
  },
  {
    key: 'privacy-safety',
    labelVi: 'Quyền riêng tư và an toàn',
    labelEn: 'Privacy and safety',
    icon: <FaUserShield />,
    color: '#7c3aed',
    children: [
      {
        key: 'privacy-settings',
        labelVi: 'Cài đặt quyền riêng tư',
        labelEn: 'Privacy settings',
        icon: <FaUserShield />,
        color: '#7c3aed',
      },
      {
        key: 'safety',
        labelVi: 'An toàn',
        labelEn: 'Safety',
        icon: <FaShieldAlt />,
        color: '#7c3aed',
      },
    ],
  },
  {
    key: 'policies',
    labelVi: 'Chính sách',
    labelEn: 'Policies',
    icon: <FaFileAlt />,
    color: '#d93025',
    children: [
      {
        key: 'community-standards',
        labelVi: 'Tiêu chuẩn cộng đồng',
        labelEn: 'Community Standards',
        icon: <FaFileAlt />,
        color: '#d93025',
      },
      {
        key: 'terms',
        labelVi: 'Điều khoản',
        labelEn: 'Terms of Service',
        icon: <FaFileAlt />,
        color: '#d93025',
      },
    ],
  },
  {
    key: 'reporting',
    labelVi: 'Báo cáo',
    labelEn: 'Reporting',
    icon: <FaFlag />,
    color: '#d93025',
    children: [
      {
        key: 'report-content',
        labelVi: 'Báo cáo nội dung',
        labelEn: 'Report content',
        icon: <FaFlag />,
        color: '#d93025',
      },
    ],
  },
]

function getCategoryContent(key: string): CategoryContent {
  const contents: Record<string, CategoryContent> = {
    'creating-account': {
      bannerDescVi: 'Fakebook giúp bạn kết nối và chia sẻ với mọi người trong cuộc sống của bạn.',
      bannerDescEn: 'Fakebook helps you connect and share with the people in your life.',
      sections: [
        { key: 'create', titleVi: 'Tạo tài khoản', titleEn: 'Create an account' },
        { key: 'verify', titleVi: 'Xác minh tài khoản', titleEn: 'Verify your account' },
      ],
      quickActions: [
        { labelVi: 'Tạo tài khoản', labelEn: 'Create an account' },
        { labelVi: 'Xác nhận tài khoản', labelEn: 'Confirm my account' },
        { labelVi: 'Mã định danh', labelEn: 'Snowflake ID' },
      ],
      articles: [
        {
          id: 'create-acc',
          titleVi: 'Tạo tài khoản Fakebook cá nhân',
          titleEn: 'Create a Fakebook profile',
          section: 'create',
          contentVi: (
            <div>
              <p>Để tạo tài khoản Fakebook, bạn cần đủ từ 14 tuổi trở lên, cung cấp họ tên, ngày sinh, giới tính và địa chỉ Email hoặc số điện thoại hợp lệ.</p>
              <ul>
                <li>Truy cập trang đăng ký Fakebook tại fakebook.com hoặc ứng dụng di động.</li>
                <li>Nhập họ tên đầy đủ, email/số điện thoại và mật khẩu mạnh (ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký hiệu).</li>
                <li>Chọn ngày sinh và giới tính của bạn.</li>
                <li>Nhấn Đăng ký để nhận mã xác thực qua email hoặc SMS.</li>
                <li>Nhập mã xác thực để hoàn tất đăng ký.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo bảo mật:</strong> Sử dụng mật khẩu mạnh gồm ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt. Không sử dụng mật khẩu giống với các dịch vụ khác.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>To create a Fakebook account, you must be at least 14 years old, provide your full name, date of birth, gender, and a valid email address or phone number.</p>
              <ul>
                <li>Go to the Fakebook sign-up page at fakebook.com or the mobile app.</li>
                <li>Enter your full name, email/phone, and a strong password (at least 8 characters with uppercase, lowercase, numbers, and symbols).</li>
                <li>Select your date of birth and gender.</li>
                <li>Click Sign Up to receive a verification code via email or SMS.</li>
                <li>Enter the verification code to complete registration.</li>
              </ul>
              <div className="help-callout">
                <strong>Security Tip:</strong> Use a strong password with at least 8 characters including uppercase, lowercase, numbers, and special symbols. Do not reuse passwords from other services.
              </div>
            </div>
          ),
        },
        {
          id: 'confirm-acc',
          titleVi: 'Xác thực tài khoản qua email / OTP',
          titleEn: 'Confirm your Fakebook account',
          section: 'verify',
          contentVi: (
            <div>
              <p>Fakebook yêu cầu xác thực OTP gửi về Email/SMS nhằm đảm bảo an toàn tài khoản và ngăn ngừa tài khoản ảo.</p>
              <ul>
                <li>Kiểm tra hộp thư email hoặc tin nhắn SMS để nhận mã xác thực 6 chữ số.</li>
                <li>Nhập mã vào ô xác thực trên trang Fakebook.</li>
                <li>Nếu mã không hợp lệ, đảm bảo bạn nhập đúng và chưa hết hạn (mã có hiệu lực trong 10 phút).</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý về mã xác thực:</strong> Nếu không nhận được mã trong 60 giây, kiểm tra hộp thư Rác (Spam/Junk) hoặc thư mục quảng cáo. Bạn cũng có thể bấm "Gửi lại mã" để nhận mã mới.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook requires OTP verification sent via Email/SMS to protect account security and prevent fake accounts.</p>
              <ul>
                <li>Check your email inbox or SMS messages for a 6-digit verification code.</li>
                <li>Enter the code in the verification field on the Fakebook page.</li>
                <li>If the code is invalid, make sure you entered it correctly and it has not expired (codes are valid for 10 minutes).</li>
              </ul>
              <div className="help-callout">
                <strong>Verification Code Tip:</strong> If you do not receive the code within 60 seconds, check your Spam/Junk folder or promotions tab. You can also click "Resend Code" to get a new code.
              </div>
            </div>
          ),
        },
        {
          id: 'age-requirement',
          titleVi: 'Yêu cầu độ tuổi để sử dụng Fakebook',
          titleEn: 'Age requirements for using Fakebook',
          section: 'create',
          contentVi: (
            <div>
              <p>Để sử dụng Fakebook, bạn phải từ 14 tuổi trở lên. Nếu bạn dưới 14 tuổi, Fakebook không cho phép tạo tài khoản cá nhân.</p>
              <ul>
                <li>Fakebook yêu cầu người dùng phải từ 14 tuổi trở lên theo chính sách bảo vệ trẻ em.</li>
                <li>Nếu bạn đại diện cho con em dưới 13 tuổi, hãy tìm hiểu về tài khoản Family trên Fakebook để quản lý trải nghiệm của con em.</li>
                <li>Tài khoản Family cho phép phụ huynh giám sát và kiểm soát nội dung mà con em tiếp cận.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>To use Fakebook, you must be at least 14 years old. If you are under 14, Fakebook does not allow personal account creation.</p>
              <ul>
                <li>Fakebook requires users to be at least 14 years old in line with child protection policies.</li>
                <li>If you are a parent or guardian of a child under 13, explore Fakebook Family accounts to manage your child's experience.</li>
                <li>Family accounts allow parents to monitor and control the content their children access.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'duplicate-account',
          titleVi: 'Tài khoản trùng lặp trên Fakebook',
          titleEn: 'Duplicate accounts on Fakebook',
          section: 'verify',
          contentVi: (
            <div>
              <p>Fakebook chỉ cho phép mỗi người dùng sở hữu một tài khoản cá nhân. Nếu bạn tạo nhiều tài khoản, Fakebook có thể:</p>
              <ul>
                <li>Yêu cầu bạn chọn tài khoản chính và vô hiệu hóa các tài khoản còn lại.</li>
                <li>Gộp các tài khoản trùng lặp để bảo toàn dữ liệu.</li>
                <li>Khóa tài khoản nếu phát hiện vi phạm chính sách nhiều tài khoản.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Nếu bạn có tài khoản cũ không còn truy cập được, hãy thử khôi phục tài khoản đó trước khi tạo tài khoản mới.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook only allows each user to own one personal account. If you create multiple accounts, Fakebook may:</p>
              <ul>
                <li>Ask you to choose a primary account and disable the remaining ones.</li>
                <li>Merge duplicate accounts to preserve your data.</li>
                <li>Lock accounts if multiple-account policy violations are detected.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> If you have an old account you can no longer access, try recovering it before creating a new one.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Tạo tài khoản Fakebook', labelEn: 'Create a Fakebook account' },
        { labelVi: 'Xác minh tài khoản của bạn', labelEn: 'Verify your account' },
        { labelVi: 'Mã định danh Snowflake', labelEn: 'Snowflake ID system' },
      ],
    },
    'your-profile': {
      bannerDescVi: 'Trang cá nhân kể câu chuyện của bạn. Bạn có thể chọn chia sẻ sở thích, ảnh và thông tin cá nhân.',
      bannerDescEn: 'Your profile tells your story. You can choose what to share, such as interests, photos and personal information.',
      sections: [
        { key: 'profile-info', titleVi: 'Thông tin trang cá nhân', titleEn: 'Profile information' },
        { key: 'photos-cover', titleVi: 'Ảnh và ảnh bìa', titleEn: 'Photos and cover' },
      ],
      quickActions: [
        { labelVi: 'Thêm ảnh đại diện', labelEn: 'Add a profile picture' },
        { labelVi: 'Chỉnh sửa thông tin', labelEn: 'Edit my profile info' },
        { labelVi: 'Quản lý bài viết', labelEn: 'Manage my posts' },
      ],
      articles: [
        {
          id: 'edit-profile',
          titleVi: 'Chỉnh sửa thông tin trang cá nhân',
          titleEn: 'Edit your profile information',
          section: 'profile-info',
          contentVi: (
            <div>
              <p>Bạn có thể cập nhật thông tin trang cá nhân bất kỳ lúc nào từ trang Profile.</p>
              <ul>
                <li>Truy cập trang cá nhân của bạn và nhấn nút "Chỉnh sửa trang cá nhân".</li>
                <li>Chỉnh sửa tiểu sử (Bio), nghề nghiệp, nơi học, nơi ở và các thông tin khác.</li>
                <li>Nhấn "Lưu thay đổi" để cập nhật.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo:</strong> Thông tin chi tiết giúp bạn bè và người thân hiểu thêm về bạn. Hãy giữ thông tin cập nhật và chính xác.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can update your profile information anytime from your Profile page.</p>
              <ul>
                <li>Go to your profile and click the "Edit profile" button.</li>
                <li>Edit your bio, work, education, location, and other details.</li>
                <li>Click "Save changes" to update.</li>
              </ul>
              <div className="help-callout">
                <strong>Tip:</strong> Detailed information helps friends and family learn more about you. Keep your information up to date and accurate.
              </div>
            </div>
          ),
        },
        {
          id: 'change-name',
          titleVi: 'Cách đổi tên trên Fakebook',
          titleEn: 'How to change your name on Fakebook',
          section: 'profile-info',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi tên Fakebook của mình trong Cài đặt.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Chung &gt; Tên.</li>
                <li>Nhập tên mới và nhấn "Xem lại thay đổi".</li>
                <li>Nhập mật khẩu để xác nhận và nhấn "Lưu thay đổi".</li>
              </ul>
              <div className="help-callout">
                <strong>Quy tắc đặt tên:</strong> Tên phải tuân thủ Tiêu chuẩn cộng đồng Fakebook. Không sử dụng tên giả, tên thương hiệu hoặc ký hiệu đặc biệt. Bạn chỉ có thể thay đổi tên một lần trong 60 ngày.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change your Fakebook name in Settings.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; General &gt; Name.</li>
                <li>Enter your new name and click "Review Change".</li>
                <li>Enter your password to confirm and click "Save changes".</li>
              </ul>
              <div className="help-callout">
                <strong>Naming rules:</strong> Your name must comply with Fakebook Community Standards. Do not use fake names, brand names, or special symbols. You can only change your name once every 60 days.
              </div>
            </div>
          ),
        },
        {
          id: 'profile-photo',
          titleVi: 'Thêm hoặc thay đổi ảnh đại diện',
          titleEn: 'Add or change your profile picture',
          section: 'photos-cover',
          contentVi: (
            <div>
              <p>Ảnh đại diện là hình ảnh đầu tiên mọi người nhìn thấy khi truy cập trang cá nhân của bạn.</p>
              <ul>
                <li>Truy cập trang cá nhân và di chuột vào ảnh đại diện hiện tại.</li>
                <li>Nhấn "Cập nhật ảnh" và chọn "Tải ảnh lên".</li>
                <li>Chọn ảnh từ thiết bị của bạn, điều chỉnh khung cắt và nhấn "Lưu".</li>
              </ul>
              <div className="help-callout">
                <strong>Gợi ý:</strong> Ảnh đại diện nên có tỷ lệ 1:1 (vuông), kích thước tối thiểu 180x180 pixel để hiển thị rõ nét.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Your profile picture is the first thing people see when they visit your profile.</p>
              <ul>
                <li>Go to your profile and hover over your current profile picture.</li>
                <li>Click "Update photo" and select "Upload photo".</li>
                <li>Choose a photo from your device, adjust the crop, and click "Save".</li>
              </ul>
              <div className="help-callout">
                <strong>Recommendation:</strong> Your profile picture should have a 1:1 (square) aspect ratio and a minimum size of 180x180 pixels for clear display.
              </div>
            </div>
          ),
        },
        {
          id: 'cover-photo',
          titleVi: 'Thêm hoặc chỉnh sửa ảnh bìa',
          titleEn: 'Add or edit your cover photo',
          section: 'photos-cover',
          contentVi: (
            <div>
              <p>Ảnh bìa là hình ảnh nền lớn ở đầu trang cá nhân, giúp thể hiện sở thích hoặc phong cách của bạn.</p>
              <ul>
                <li>Truy cập trang cá nhân và di chuột vào khu vực ảnh bìa.</li>
                <li>Nhấn "Cập nhật ảnh bìa" và chọn ảnh từ thiết bị hoặc thư viện ảnh.</li>
                <li>Điều chỉnh vị trí ảnh và nhấn "Lưu thay đổi".</li>
              </ul>
              <div className="help-callout">
                <strong>Kích thước khuyến nghị:</strong> Ảnh bìa nên có kích thước 820x312 pixel để hiển thị tốt nhất trên cả máy tính và điện thoại.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Your cover photo is the large background image at the top of your profile, expressing your interests or style.</p>
              <ul>
                <li>Go to your profile and hover over the cover photo area.</li>
                <li>Click "Update cover photo" and choose a photo from your device or photo library.</li>
                <li>Adjust the photo position and click "Save changes".</li>
              </ul>
              <div className="help-callout">
                <strong>Size recommendation:</strong> Your cover photo should be 820x312 pixels for optimal display on both desktop and mobile.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Chỉnh sửa thông tin trang cá nhân', labelEn: 'Edit profile info' },
        { labelVi: 'Ảnh đại diện và ảnh bìa', labelEn: 'Profile picture and cover photo' },
        { labelVi: 'Quản lý bài viết trên trang cá nhân', labelEn: 'Manage posts on your profile' },
      ],
    },
    'friending': {
      bannerDescVi: 'Kết bạn giúp bạn duy trì mối quan hệ với những người thân yêu.',
      bannerDescEn: 'Friending helps you maintain relationships with the people you care about.',
      sections: [
        { key: 'friend-req', titleVi: 'Lời mời kết bạn', titleEn: 'Friend requests' },
        { key: 'manage-friends', titleVi: 'Quản lý bạn bè', titleEn: 'Managing friends' },
      ],
      quickActions: [
        { labelVi: 'Gửi lời mời kết bạn', labelEn: 'Send a friend request' },
        { labelVi: 'Chấp nhận lời mời', labelEn: 'Accept a friend request' },
        { labelVi: 'Chặn người dùng', labelEn: 'Block someone' },
      ],
      articles: [
        {
          id: 'friend-requests',
          titleVi: 'Gửi và chấp nhận lời mời kết bạn',
          titleEn: 'Sending and accepting friend requests',
          section: 'friend-req',
          contentVi: (
            <div>
              <p>Kết nối với bạn bè và người thân trên Fakebook bằng cách gửi và chấp nhận lời mời kết bạn.</p>
              <ul>
                <li>Sử dụng thanh tìm kiếm ở đầu trang để tìm người mà bạn muốn kết bạn.</li>
                <li>Nhấn "Thêm bạn bè" trên trang cá nhân của họ để gửi lời mời.</li>
                <li> Kiểm tra mục "Lời mời kết bạn" để xem và chấp nhận các lời mời chưa xử lý.</li>
                <li>Bạn cũng có thể xem gợi ý kết bạn dựa trên bạn bè chung và sở thích.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo:</strong> Bạn chỉ có thể gửi tối đa 1,000 lời mời kết bạn đang chờ xử lý tại một thời điểm. Nếu reached giới hạn, hãy hủy các lời mời cũ chưa được chấp nhận.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Connect with friends and family on Fakebook by sending and accepting friend requests.</p>
              <ul>
                <li>Use the search bar at the top of the page to find people you want to add.</li>
                <li>Click "Add Friend" on their profile to send a request.</li>
                <li>Check the "Friend Requests" section to view and accept pending requests.</li>
                <li>You can also view friend suggestions based on mutual friends and interests.</li>
              </ul>
              <div className="help-callout">
                <strong>Tip:</strong> You can only have up to 1,000 pending friend requests at a time. If you reach the limit, cancel old requests that haven't been accepted.
              </div>
            </div>
          ),
        },
        {
          id: 'unfriend',
          titleVi: 'Hủy kết bạn trên Fakebook',
          titleEn: 'Unfriend someone on Fakebook',
          section: 'manage-friends',
          contentVi: (
            <div>
              <p>Nếu bạn muốn xóa ai đó khỏi danh sách bạn bè, bạn có thể hủy kết bạn bất kỳ lúc nào.</p>
              <ul>
                <li>Truy cập trang cá nhân của người mà bạn muốn hủy kết bạn.</li>
                <li>Nhấn nút "Bạn bè" và chọn "Hủy kết bạn".</li>
                <li>Xác nhận bằng cách nhấn "Xác nhận" trong hộp thoại.</li>
              </ul>
              <p>Sau khi hủy kết bạn, họ sẽ không còn thấy bài viết của bạn trong Bảng tin (trừ khi bạn đặt ở chế độ Công khai).</p>
            </div>
          ),
          contentEn: (
            <div>
              <p>If you want to remove someone from your friends list, you can unfriend them at any time.</p>
              <ul>
                <li>Go to the profile of the person you want to unfriend.</li>
                <li>Click the "Friends" button and select "Unfriend".</li>
                <li>Confirm by clicking "Confirm" in the dialog box.</li>
              </ul>
              <p>After unfriending, they will no longer see your posts in their News Feed (unless your posts are set to Public).</p>
            </div>
          ),
        },
        {
          id: 'block-user',
          titleVi: 'Chặn người dùng trên Fakebook',
          titleEn: 'Block someone on Fakebook',
          section: 'manage-friends',
          contentVi: (
            <div>
              <p>Chặn người dùng là cách nhanh nhất để ngăn ai đó liên hệ hoặc xem nội dung của bạn trên Fakebook.</p>
              <ul>
                <li>Truy cập trang cá nhân của người mà bạn muốn chặn.</li>
                <li>Nhấn nút ba chấm (...) và chọn "Chặn".</li>
                <li>Xác nhận chặn trong hộp thoại hiển thị.</li>
              </ul>
              <p>Khi chặn ai đó:</p>
              <ul>
                <li>Họ sẽ không thể xem trang cá nhân, bài viết hoặc ảnh của bạn.</li>
                <li>Họ không thể gửi tin nhắn hoặc kết bạn với bạn.</li>
                <li>Họ sẽ không nhận được thông báo rằng bạn đã chặn họ.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý về quyền riêng tư:</strong> Hành động chặn là riêng tư và không được thông báo cho người bị chặn. Bạn có thể bỏ chặn bất kỳ lúc nào trong phần Cài đặt.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Blocking someone is the quickest way to prevent them from contacting you or viewing your content on Fakebook.</p>
              <ul>
                <li>Go to the profile of the person you want to block.</li>
                <li>Click the three-dot menu (...) and select "Block".</li>
                <li>Confirm the block in the dialog box that appears.</li>
              </ul>
              <p>When you block someone:</p>
              <ul>
                <li>They cannot see your profile, posts, or photos.</li>
                <li>They cannot send you messages or add you as a friend.</li>
                <li>They will not be notified that you have blocked them.</li>
              </ul>
              <div className="help-callout">
                <strong>Privacy note:</strong> Blocking is private and the blocked person is not notified. You can unblock someone at any time in Settings.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Tìm kiếm bạn bè', labelEn: 'Find friends' },
        { labelVi: 'Chặn người dùng', labelEn: 'Block someone' },
      ],
    },
    'your-home-page': {
      bannerDescVi: 'Bảng tin hiển thị các bài viết và nội dung phù hợp với sở thích của bạn.',
      bannerDescEn: 'Your home feed shows posts and content relevant to your interests.',
      quickActions: [
        { labelVi: 'Đăng bài viết', labelEn: 'Create a post' },
        { labelVi: 'Xem tất cả', labelEn: 'See all' },
      ],
      articles: [
        {
          id: 'feed-rec',
          titleVi: 'Bảng tin & Thuật toán gợi ý',
          titleEn: 'Home Feed & Recommendation Algorithm',
          contentVi: (
            <div>
              <p>Bảng tin Fakebook được tối ưu hóa bằng dịch vụ Backend-Recommendation dựa trên vector nhúng sở thích (Interest Embedding Vectors), giúp hiển thị các nội dung phù hợp nhất với bạn.</p>
              <p>Thứ tự hiển thị bài viết trong Bảng tin bị ảnh hưởng bởi:</p>
              <ul>
                <li>Mức độ tương tác của bạn với người đăng (like, bình luận, chia sẻ).</li>
                <li>Loại nội dung bạn thường xem (video, ảnh, bài viết dài).</li>
                <li>Thời gian đăng bài và mức độ tương tác tổng thể của bài viết.</li>
                <li>Mối quan hệ của bạn với người đăng (bạn bè thân thiết, gia đình).</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook Home Feed is powered by the Backend-Recommendation microservice using Interest Embedding Vectors to suggest content most relevant to your interests.</p>
              <p>The order of posts in your feed is influenced by:</p>
              <ul>
                <li>Your interaction level with the poster (likes, comments, shares).</li>
                <li>The type of content you typically watch (videos, photos, long posts).</li>
                <li>Post timing and overall engagement of the post.</li>
                <li>Your relationship with the poster (close friends, family).</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'feed-customise',
          titleVi: 'Tùy chỉnh Bảng tin trên Fakebook',
          titleEn: 'Customise your Fakebook feed',
          contentVi: (
            <div>
              <p>Bạn có thể kiểm soát nội dung hiển thị trong Bảng tin để ưu tiên những gì quan trọng với bạn.</p>
              <ul>
                <li><strong>Ưu tiên bạn bè yêu thích:</strong> Đặt bạn bè vào danh sách "Bạn bè thân thiết" để luôn看到 bài viết của họ ở đầu Bảng tin.</li>
                <li><strong>Giảm nội dung không mong muốn:</strong> Nhấn nút ba chấm (...) trên bài viết và chọn "Giảm看到类似 nội dung này" hoặc "Ẩn bài viết".</li>
                <li><strong>Cập nhật sở thích:</strong> Truy cập Cài đặt &gt; Sở thích để cập nhật các chủ đề bạn quan tâm, giúp thuật toán gợi ý chính xác hơn.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can control what appears in your feed to prioritise what matters most to you.</p>
              <ul>
                <li><strong>Prioritise favourite friends:</strong> Add friends to your "Close Friends" list to always see their posts at the top of your feed.</li>
                <li><strong>Reduce unwanted content:</strong> Click the three-dot menu (...) on a post and select "Reduce posts like this" or "Hide post".</li>
                <li><strong>Update interests:</strong> Go to Settings &gt; Interests to update the topics you care about, helping the algorithm suggest more relevant content.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Bảng tin hoạt động như thế nào?', labelEn: 'How does the home feed work?' },
        { labelVi: 'Tùy chỉnh bảng tin', labelEn: 'Customise your feed' },
      ],
    },
    'messaging': {
      bannerDescVi: 'Nhắn tin giúp bạn kết nối với bạn bè và gia đình ngay lập tức.',
      bannerDescEn: 'Messaging helps you connect with friends and family instantly.',
      quickActions: [
        { labelVi: 'Bắt đầu cuộc trò chuyện', labelEn: 'Start a conversation' },
        { labelVi: 'Chat nhóm', labelEn: 'Group chat' },
      ],
      articles: [
        {
          id: 'msg-send',
          titleVi: 'Gửi tin nhắn trên Fakebook Messenger',
          titleEn: 'Send messages on Fakebook Messenger',
          contentVi: (
            <div>
              <p>Fakebook Messenger cho phép bạn nhắn tin 1-1 hoặc trong nhóm với bạn bè và gia đình.</p>
              <ul>
                <li>Mở Messenger và nhấn nút soạn tin mới (biểu tượng bút chì).</li>
                <li>Chọn người nhận hoặc tìm kiếm tên trong danh sách liên hệ.</li>
                <li>Nhập tin nhắn và nhấn Enter hoặc biểu tượng gửi.</li>
                <li>Bạn có thể đính kèm ảnh, video, file và biểu tượng cảm xúc vào tin nhắn.</li>
              </ul>
              <div className="help-callout">
                <strong>Yêu cầu tin nhắn:</strong> Nếu bạn nhắn tin cho người không phải bạn bè, tin nhắn sẽ được gửi đến hộp "Yêu cầu tin nhắn". Người nhận cần chấp nhận trước khi bạn có thể tiếp tục trò chuyện.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook Messenger lets you send 1-1 or group messages to friends and family.</p>
              <ul>
                <li>Open Messenger and click the new message icon (pencil icon).</li>
                <li>Select a recipient or search for a name in your contacts.</li>
                <li>Type your message and press Enter or the send button.</li>
                <li>You can attach photos, videos, files, and emojis to your messages.</li>
              </ul>
              <div className="help-callout">
                <strong>Message requests:</strong> If you message someone who is not your friend, the message goes to their "Message Requests" inbox. They need to accept it before you can continue the conversation.
              </div>
            </div>
          ),
        },
        {
          id: 'group-chat',
          titleVi: 'Tạo và quản lý nhóm chat trên Messenger',
          titleEn: 'Create and manage group chats on Messenger',
          contentVi: (
            <div>
              <p>Nhóm chat cho phép bạn trò chuyện cùng lúc với nhiều người trên Fakebook Messenger.</p>
              <ul>
                <li>Mở Messenger và nhấn nút soạn tin mới.</li>
                <li>Chọn nhiều người bạn muốn thêm vào nhóm.</li>
                <li>Nhập tên nhóm (tùy chọn) và bắt đầu trò chuyện.</li>
                <li>Để quản lý nhóm: nhấn tên nhóm ở đầu cuộc trò chuyện &gt; "Thông tin nhóm".</li>
                <li>Bạn có thể thêm/bớt thành viên, thay đổi tên và ảnh nhóm.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Group chats let you talk to multiple people at once on Fakebook Messenger.</p>
              <ul>
                <li>Open Messenger and click the new message icon.</li>
                <li>Select multiple friends you want to add to the group.</li>
                <li>Enter a group name (optional) and start chatting.</li>
                <li>To manage the group: tap the group name at the top of the conversation &gt; "Group info".</li>
                <li>You can add/remove members, change the group name and photo.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'msg-read-receipts',
          titleVi: 'Biểu tượng đã đọc và trạng thái nhập tin',
          titleEn: 'Read receipts and typing indicators',
          contentVi: (
            <div>
              <p>Fakebook Messenger hiển thị trạng thái đọc và nhập tin để bạn biết khi nào tin nhắn đã được nhận và đọc.</p>
              <ul>
                <li><strong>Đã gửi:</strong> Dấu kiểm đơn (✓) xuất hiện khi tin nhắn đã được gửi đi.</li>
                <li><strong>Đã nhận:</strong> Dấu kiểm kép (✓✓) xuất hiện khi tin nhắn đã đến thiết bị của người nhận.</li>
                <li><strong>Đã đọc:</strong> Dấu kiểm kép chuyển sang màu xanh khi người nhận đã đọc tin nhắn.</li>
                <li><strong>Đang nhập:</strong> Ba chấm nhấp nháy hiển thị khi người kia đang soạn tin nhắn.</li>
              </ul>
              <div className="help-callout">
                <strong>Cài đặt riêng tư:</strong> Bạn có thể tắt trạng thái đã đọc trong Cài đặt &gt; Quyền riêng tư &gt; Trạng thái hoạt động. Khi tắt, bạn cũng sẽ không thấy trạng thái đã đọc của người khác.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook Messenger shows read and typing statuses so you know when messages have been received and read.</p>
              <ul>
                <li><strong>Sent:</strong> A single checkmark (✓) appears when your message has been sent.</li>
                <li><strong>Delivered:</strong> A double checkmark (✓✓) appears when the message has reached the recipient's device.</li>
                <li><strong>Read:</strong> The double checkmark turns blue when the recipient has read your message.</li>
                <li><strong>Typing:</strong> Three bouncing dots appear when the other person is composing a message.</li>
              </ul>
              <div className="help-callout">
                <strong>Privacy setting:</strong> You can turn off read receipts in Settings &gt; Privacy &gt; Activity Status. When off, you also won't see read statuses from others.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Nhắn tin với bạn bè', labelEn: 'Message friends' },
        { labelVi: 'Tạo nhóm chat', labelEn: 'Create a group chat' },
      ],
    },
    'reels': {
      bannerDescVi: 'Reels giúp bạn tạo và chia sẻ video ngắn sáng tạo.',
      bannerDescEn: 'Reels helps you create and share creative short videos.',
      quickActions: [
        { labelVi: 'Tạo Reels', labelEn: 'Create a Reel' },
        { labelVi: 'Xem Reels', labelEn: 'Watch Reels' },
      ],
      articles: [
        {
          id: 'reels-create',
          titleVi: 'Tạo và xem Thước phim ngắn',
          titleEn: 'Create and watch short video Reels',
          contentVi: (
            <div>
              <p>Đăng tải các video ngắn với công cụ cắt ghép, điều chỉnh âm thanh và giao diện phát ambient sống động.</p>
            </div>
          ),
          contentEn: (
            <div>
              <p>Upload short video clips with cropping tools, audio controls, and an immersive ambient player.</p>
            </div>
          ),
        },
        {
          id: 'reels-engage',
          titleVi: 'Tương tác với Reels trên Fakebook',
          titleEn: 'Engage with Reels on Fakebook',
          contentVi: (
            <div>
              <p>Bạn có thể tương tác với Reels theo nhiều cách để thể hiện sự yêu thích và chia sẻ nội dung.</p>
              <ul>
                <li><strong>Like:</strong> Nhấn biểu tượng trái tim hoặc vuốt lên để thích Reel.</li>
                <li><strong>Bình luận:</strong> Nhấn biểu tượng bình luận để chia sẻ suy nghĩ của bạn.</li>
                <li><strong>Chia sẻ:</strong> Nhấn biểu tượng chia sẻ để gửi Reel cho bạn bè hoặc đăng lên Bảng tin.</li>
                <li><strong>Lưu:</strong> Nhấn biểu tượng bookmark để lưu Reel vào mục "Đã lưu" để xem lại sau.</li>
                <li><strong>Theo dõi:</strong> Nhấn nút "Theo dõi" trên video để không bỏ lỡ nội dung mới từ người sáng tạo.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can engage with Reels in multiple ways to show appreciation and share content.</p>
              <ul>
                <li><strong>Like:</strong> Tap the heart icon or swipe up to like a Reel.</li>
                <li><strong>Comment:</strong> Tap the comment icon to share your thoughts.</li>
                <li><strong>Share:</strong> Tap the share icon to send a Reel to friends or post it to your feed.</li>
                <li><strong>Save:</strong> Tap the bookmark icon to save a Reel to your "Saved" collection to watch later.</li>
                <li><strong>Follow:</strong> Tap the "Follow" button on the video to keep up with new content from the creator.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Cách tạo Reels', labelEn: 'How to create Reels' },
        { labelVi: 'Tách màu Ambient', labelEn: 'Ambient color extraction' },
      ],
    },
    'stories': {
      bannerDescVi: 'Tin giúp bạn chia sẻ khoảnh khắc trong 24 giờ.',
      bannerDescEn: 'Stories help you share moments for 24 hours.',
      quickActions: [
        { labelVi: 'Đăng Tin', labelEn: 'Share a Story' },
      ],
      articles: [
        {
          id: 'stories-create',
          titleVi: 'Tạo và đăng Tin trên Fakebook',
          titleEn: 'Create and share Stories on Fakebook',
          contentVi: (
            <div>
              <p>Tin (Stories) cho phép bạn chia sẻ hình ảnh và video biến mất tự động sau 24 giờ.</p>
              <ul>
                <li>Truy cập Bảng tin và nhấn "Thêm vào Tin" ở đầu trang.</li>
                <li>Chọn ảnh hoặc video từ thư viện, hoặc chụp/quay trực tiếp.</li>
                <li>Thêm văn bản, hình dán, hiệu ứng hoặc nhạc vào Tin của bạn.</li>
                <li>Nhấn "Đăng Tin" để chia sẻ với bạn bè hoặc đối tượng tùy chỉnh.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo:</strong> Bạn có thể chọn đối tượng cụ thể (Bạn bè, Bạn bè thân thiết,...) khi đăng Tin để kiểm soát ai có thể xem.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Stories let you share photos and videos that automatically disappear after 24 hours.</p>
              <ul>
                <li>Go to your News Feed and tap "Add to Story" at the top.</li>
                <li>Choose a photo or video from your library, or capture directly.</li>
                <li>Add text, stickers, effects, or music to your Story.</li>
                <li>Tap "Share Story" to share with friends or a custom audience.</li>
              </ul>
              <div className="help-callout">
                <strong>Tip:</strong> You can choose a specific audience (Friends, Close Friends, ...) when sharing to control who can see your Story.
              </div>
            </div>
          ),
        },
        {
          id: 'stories-view',
          titleVi: 'Xem và điều hướng Tin trên Fakebook',
          titleEn: 'View and navigate Stories on Fakebook',
          contentVi: (
            <div>
              <p>Tin từ bạn bè hiển thị ở đầu Bảng tin dưới dạng vòng tròn nhiều màu.</p>
              <ul>
                <li>Nhấn vào vòng tròn Tin của ai đó để xem.</li>
                <li>Nhấn bên phải màn hình để xem Tin tiếp theo, nhấn bên trái để xem Tin trước đó.</li>
                <li>Nhấn vào giữa màn hình để tạm dừng Tin.</li>
                <li>Nhấn "Trả lời" ở cuối màn hình để phản hồi Tin của họ.</li>
                <li>Nhấn mũi tên quay lại hoặc vuốt xuống để thoát khỏi Tin.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Stories from friends appear at the top of your News Feed as colourful rings.</p>
              <ul>
                <li>Tap someone's Story ring to view their Story.</li>
                <li>Tap the right side of the screen to go to the next Story, tap the left side for the previous one.</li>
                <li>Tap the middle of the screen to pause a Story.</li>
                <li>Tap "Reply" at the bottom to respond to their Story.</li>
                <li>Tap the back arrow or swipe down to exit Stories.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Đăng Tin', labelEn: 'Share a Story' },
        { labelVi: 'Xem Tin', labelEn: 'View Stories' },
      ],
    },
    'photos': {
      bannerDescVi: 'Ảnh giúp bạn lưu giữ và chia sẻ kỷ niệm.',
      bannerDescEn: 'Photos help you preserve and share memories.',
      quickActions: [
        { labelVi: 'Tải ảnh lên', labelEn: 'Upload a photo' },
        { labelVi: 'Tạo album', labelEn: 'Create an album' },
      ],
      articles: [
        {
          id: 'upload-photo',
          titleVi: 'Tải ảnh lên Fakebook',
          titleEn: 'Upload photos to Fakebook',
          contentVi: (
            <div>
              <p>Bạn có thể tải ảnh lên từ máy tính hoặc điện thoại. Hỗ trợ định dạng JPG, PNG và GIF.</p>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can upload photos from your computer or phone. Supports JPG, PNG, and GIF formats.</p>
            </div>
          ),
        },
        {
          id: 'create-album',
          titleVi: 'Tạo và quản lý album ảnh trên Fakebook',
          titleEn: 'Create and manage photo albums on Fakebook',
          contentVi: (
            <div>
              <p>Album ảnh giúp bạn tổ chức và chia sẻ bộ sưu tập ảnh theo sự kiện hoặc chủ đề.</p>
              <ul>
                <li>Truy cập trang cá nhân &gt; Ảnh &gt; Album &gt; "Tạo album".</li>
                <li>Nhập tên album và chọn đối tượng chia sẻ (Công khai, Bạn bè, Chỉ mình tôi,...).</li>
                <li>Thêm ảnh từ thiết bị hoặc từ ảnh đã tải lên Fakebook.</li>
                <li>Nhấn "Đăng" để hoàn tất và chia sẻ album.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo:</strong> Bạn có thể thêm ảnh vào album bất kỳ lúc nào bằng cách mở ảnh và chọn "Thêm vào album".
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Photo albums help you organise and share collections of photos by event or theme.</p>
              <ul>
                <li>Go to your profile &gt; Photos &gt; Albums &gt; "Create Album".</li>
                <li>Enter an album name and choose a sharing audience (Public, Friends, Only me, ...).</li>
                <li>Add photos from your device or from photos already uploaded to Fakebook.</li>
                <li>Click "Post" to finish and share the album.</li>
              </ul>
              <div className="help-callout">
                <strong>Tip:</strong> You can add photos to an album at any time by opening a photo and selecting "Add to album".
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Tải ảnh lên', labelEn: 'Upload a photo' },
        { labelVi: 'Tạo album ảnh', labelEn: 'Create a photo album' },
      ],
    },
    'videos': {
      bannerDescVi: 'Video giúp bạn chia sẻ những khoảnh khắc sống động.',
      bannerDescEn: 'Videos help you share vivid moments.',
      quickActions: [
        { labelVi: 'Đăng video', labelEn: 'Upload a video' },
      ],
      articles: [
        {
          id: 'upload-video',
          titleVi: 'Đăng video lên Fakebook',
          titleEn: 'Upload videos to Fakebook',
          contentVi: (
            <div>
              <p>Bạn có thể đăng video dài hoặc ngắn lên Fakebook. Hỗ trợ các định dạng MP4, MOV.</p>
              <ul>
                <li>Truy cập Bảng tin và nhấn "Ảnh/Video".</li>
                <li>Chọn video từ thiết bị của bạn.</li>
                <li>Thêm tiêu đề, mô tả và chọn đối tượng chia sẻ.</li>
                <li>Sử dụng trình chỉnh sửa để cắt video, thêm phụ đề hoặc điều chỉnh nhạc nền.</li>
                <li>Nhấn "Đăng" để tải video lên và chia sẻ.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Video có thể mất vài phút để xử lý tùy thuộc vào kích thước tệp. Bạn có thể tiếp tục sử dụng Fakebook trong khi chờ xử lý.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can upload long or short videos to Fakebook. Supports MP4 and MOV formats.</p>
              <ul>
                <li>Go to your News Feed and click "Photo/Video".</li>
                <li>Select a video from your device.</li>
                <li>Add a title, description, and choose a sharing audience.</li>
                <li>Use the editor to trim the video, add captions, or adjust background music.</li>
                <li>Click "Post" to upload and share the video.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> Videos may take a few minutes to process depending on file size. You can continue using Fakebook while processing.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Đăng video', labelEn: 'Upload a video' },
      ],
    },
    'gaming': {
      bannerDescVi: 'Trò chơi giúp bạn giải trí và kết nối với bạn bè.',
      bannerDescEn: 'Gaming helps you have fun and connect with friends.',
      quickActions: [
        { labelVi: 'Chơi game', labelEn: 'Play games' },
      ],
      articles: [
        {
          id: 'play-games',
          titleVi: 'Chơi game trên Fakebook',
          titleEn: 'Play games on Fakebook',
          contentVi: (
            <div>
              <p>Khám phá các trò chơi miễn phí trên Fakebook và thách thức bạn bè.</p>
              <ul>
                <li><strong>Khám phá game:</strong> Truy cập mục "Game" trên Bảng tin để duyệt danh sách game miễn phí theo thể loại.</li>
                <li><strong>Chơi với bạn bè:</strong> Mời bạn bè tham gia game multiplayer hoặc so điểm trên bảng xếp hạng.</li>
                <li><strong>Yêu cầu game:</strong> Nhận và gửi yêu cầu game từ bạn bè. Quản lý yêu cầu trong phần "Thông báo".</li>
                <li><strong>Lưu tiến trình:</strong> Tiến trình game được lưu tự động trên Fakebook, cho phép bạn tiếp tục chơi trên nhiều thiết bị.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Discover free games on Fakebook and challenge your friends.</p>
              <ul>
                <li><strong>Discover games:</strong> Go to the "Games" section on your News Feed to browse free games by genre.</li>
                <li><strong>Play with friends:</strong> Invite friends to join multiplayer games or compete on leaderboards.</li>
                <li><strong>Game requests:</strong> Receive and send game requests from friends. Manage requests in the "Notifications" section.</li>
                <li><strong>Save progress:</strong> Game progress is automatically saved on Fakebook, allowing you to continue playing across multiple devices.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Chơi game', labelEn: 'Play games' },
      ],
    },
    'login-password': {
      bannerDescVi: 'Giải quyết vấn đề đăng nhập và quản lý mật khẩu của bạn.',
      bannerDescEn: 'Resolve login issues and manage your password.',
      sections: [
        { key: 'forgot', titleVi: 'Quên mật khẩu', titleEn: 'Forgot password' },
        { key: 'change', titleVi: 'Đổi mật khẩu', titleEn: 'Change password' },
      ],
      quickActions: [
        { labelVi: 'Đổi mật khẩu', labelEn: 'Change password' },
        { labelVi: 'Quên mật khẩu', labelEn: 'Forgot password' },
      ],
      articles: [
        {
          id: 'forgot-pw',
          titleVi: 'Tôi quên mật khẩu Fakebook',
          titleEn: 'I forgot my Fakebook password',
          section: 'forgot',
          contentVi: (
            <div>
              <p>Nếu bạn quên mật khẩu, hãy sử dụng liên kết "Quên mật khẩu" trên trang đăng nhập.</p>
              <ul>
                <li>Truy cập trang đăng nhập Fakebook và nhấn "Quên mật khẩu?".</li>
                <li>Nhập email hoặc số điện thoại liên kết với tài khoản.</li>
                <li>Chọn phương thức nhận mã xác thực (email hoặc SMS).</li>
                <li>Nhập mã xác thực 6 chữ số bạn nhận được.</li>
                <li>Tạo mật khẩu mới và nhấn "Đổi mật khẩu".</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Nếu bạn không có quyền truy cập email hoặc số điện thoại cũ, hãy thử xác minh danh tính bằng các phương thức khác trong phần "Tài khoản bị khóa".
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>If you forgot your password, use the "Forgot password" link on the login page.</p>
              <ul>
                <li>Go to the Fakebook login page and click "Forgot password?".</li>
                <li>Enter the email or phone number linked to your account.</li>
                <li>Choose how to receive a verification code (email or SMS).</li>
                <li>Enter the 6-digit verification code you received.</li>
                <li>Create a new password and click "Change password".</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> If you no longer have access to your old email or phone number, try verifying your identity through other methods in the "Locked account" section.
              </div>
            </div>
          ),
        },
        {
          id: 'change-pw',
          titleVi: 'Cách đổi mật khẩu Fakebook',
          titleEn: 'How to change your Fakebook password',
          section: 'change',
          contentVi: (
            <div>
              <p>Để đổi mật khẩu, vào Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Bảo mật và đăng nhập &gt; Đổi mật khẩu.</p>
              <ul>
                <li>Nhập mật khẩu hiện tại của bạn.</li>
                <li>Nhập mật khẩu mới và xác nhận lại mật khẩu mới.</li>
                <li>Nhấn "Lưu thay đổi" để cập nhật mật khẩu.</li>
              </ul>
              <div className="help-callout">
                <strong>Yêu cầu mật khẩu:</strong> Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ít nhất một ký hiệu đặc biệt (!@#$%^&amp;*).
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>To change your password, go to Settings &amp; Privacy &gt; Settings &gt; Security and Login &gt; Change password.</p>
              <ul>
                <li>Enter your current password.</li>
                <li>Enter your new password and confirm it.</li>
                <li>Click "Save changes" to update your password.</li>
              </ul>
              <div className="help-callout">
                <strong>Password requirements:</strong> Your password must be at least 8 characters, including uppercase, lowercase, numbers, and at least one special symbol (!@#$%^&amp;*).
              </div>
            </div>
          ),
        },
        {
          id: 'password-requirements',
          titleVi: 'Yêu cầu mật khẩu Fakebook',
          titleEn: 'Fakebook password requirements',
          section: 'change',
          contentVi: (
            <div>
              <p>Mật khẩu mạnh giúp bảo vệ tài khoản của bạn khỏi truy cập trái phép.</p>
              <ul>
                <li>Có ít nhất 8 ký tự.</li>
                <li>Ít nhất một chữ cái viết hoa (A-Z).</li>
                <li>Ít nhất một chữ cái viết thường (a-z).</li>
                <li>Ít nhất một chữ số (0-9).</li>
                <li>Ít nhất một ký hiệu đặc biệt (!@#$%^&amp;*_-+=).</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo bảo mật:</strong> Không sử dụng mật khẩu giống với các dịch vụ khác. Sử dụng trình quản lý mật khẩu để tạo và lưu trữ mật khẩu mạnh.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>A strong password protects your account from unauthorised access.</p>
              <ul>
                <li>At least 8 characters long.</li>
                <li>At least one uppercase letter (A-Z).</li>
                <li>At least one lowercase letter (a-z).</li>
                <li>At least one number (0-9).</li>
                <li>At least one special symbol (!@#$%^&amp;*_-+=).</li>
              </ul>
              <div className="help-callout">
                <strong>Security tip:</strong> Do not reuse passwords from other services. Use a password manager to generate and store strong passwords.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Đặt lại mật khẩu', labelEn: 'Reset your password' },
        { labelVi: 'Bảo mật tài khoản', labelEn: 'Secure your account' },
      ],
    },
    'account-security': {
      bannerDescVi: 'Bảo vệ tài khoản Fakebook của bạn khỏi truy cập trái phép.',
      bannerDescEn: 'Protect your Fakebook account from unauthorised access.',
      sections: [
        { key: '2fa', titleVi: 'Xác thực hai yếu tố', titleEn: 'Two-factor authentication' },
        { key: 'devices', titleVi: 'Thiết bị đăng nhập', titleEn: 'Login devices' },
      ],
      quickActions: [
        { labelVi: 'Bật 2FA', labelEn: 'Turn on 2FA' },
        { labelVi: 'Xem thiết bị đăng nhập', labelEn: 'Review login devices' },
      ],
      articles: [
        {
          id: 'twofa',
          titleVi: 'Bảo vệ tài khoản bằng xác thực hai yếu tố (2FA)',
          titleEn: 'Protect your account with Two-Factor Authentication',
          section: '2fa',
          contentVi: (
            <div>
              <p>Bật xác thực 2 yếu tố trong Cài đặt bảo mật để tăng cường an toàn khi đăng nhập trên thiết bị lạ.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Bảo mật và đăng nhập &gt; Xác thực hai yếu tố.</li>
                <li>Chọn phương thức bảo mật: ứng dụng xác thực (Google Authenticator, Authy) hoặc SMS.</li>
                <li>Quét mã QR bằng ứng dụng xác thực trên điện thoại.</li>
                <li>Nhập mã xác thực 6 chữ số để xác nhận thiết lập.</li>
                <li>Lưu mã khôi phục (backup codes) ở nơi an toàn để sử dụng khi mất thiết bị.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Khi bật 2FA, bạn sẽ cần nhập mã xác thực từ thiết bị mỗi khi đăng nhập trên thiết bị mới.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Enable 2FA in Security Settings to protect your account when logging in from unrecognized devices.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Security and Login &gt; Two-Factor Authentication.</li>
                <li>Choose a security method: authenticator app (Google Authenticator, Authy) or SMS.</li>
                <li>Scan the QR code with an authenticator app on your phone.</li>
                <li>Enter the 6-digit verification code to confirm setup.</li>
                <li>Save your backup codes in a safe place to use when you lose your device.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> When 2FA is enabled, you will need to enter a verification code from your device each time you log in from a new device.
              </div>
            </div>
          ),
        },
        {
          id: 'review-devices',
          titleVi: 'Xem và quản lý thiết bị đăng nhập',
          titleEn: 'Review and manage login devices',
          section: 'devices',
          contentVi: (
            <div>
              <p>Bạn có thể xem tất cả các thiết bị đã đăng nhập vào tài khoản Fakebook của mình và đăng xuất từ xa nếu cần.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Bảo mật và đăng nhập &gt; Nơi bạn đã đăng nhập.</li>
                <li>Xem danh sách các thiết bị, vị trí và thời gian đăng nhập gần nhất.</li>
                <li>Nhấn "Đăng xuất" bên cạnh thiết bị đáng ngờ để đăng xuất khỏi thiết bị đó.</li>
                <li>Nhấn "Đăng xuất khỏi tất cả" để đăng xuất khỏi mọi thiết bị cùng lúc.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can view all devices logged into your Fakebook account and log out remotely if needed.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Security and Login &gt; Where you're logged in.</li>
                <li>Review the list of devices, locations, and last login times.</li>
                <li>Click "Log out" next to a suspicious device to log out from that device.</li>
                <li>Click "Log out of all sessions" to log out from all devices at once.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'trusted-devices',
          titleVi: 'Quản lý thiết bị được tin cậy',
          titleEn: 'Manage trusted devices',
          section: 'devices',
          contentVi: (
            <div>
              <p>Thiết bị tin cậy là các thiết bị bạn đã xác minh khi bật xác thực hai yếu tố. Quản lý chúng giúp bảo mật tài khoản.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Bảo mật và đăng nhập &gt; Thiết bị được tin cậy.</li>
                <li>Xem danh sách các thiết bị đã được tin cậy.</li>
                <li>Nhấn "Gỡ bỏ" bên cạnh thiết bị không còn sử dụng để xóa khỏi danh sách.</li>
              </ul>
              <div className="help-callout">
                <strong>Mẹo:</strong> Chỉ giữ lại các thiết bị bạn thường xuyên sử dụng. Xóa thiết bị cũ hoặc thiết bị lạ để tăng cường bảo mật.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Trusted devices are devices you have verified when setting up two-factor authentication. Managing them helps keep your account secure.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Security and Login &gt; Trusted devices.</li>
                <li>Review the list of trusted devices.</li>
                <li>Click "Remove" next to a device you no longer use to delete it from the list.</li>
              </ul>
              <div className="help-callout">
                <strong>Tip:</strong> Only keep devices you regularly use. Remove old or unfamiliar devices to improve security.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Bật xác thực 2 yếu tố', labelEn: 'Turn on two-factor authentication' },
        { labelVi: 'Xem thiết bị đăng nhập', labelEn: "See where you're logged in" },
      ],
    },
    'login-trouble': {
      bannerDescVi: 'Giải quyết các sự cố khi đăng nhập vào Fakebook.',
      bannerDescEn: 'Troubleshoot issues logging into Fakebook.',
      sections: [
        { key: 'locked', titleVi: 'Tài khoản bị khóa', titleEn: 'Locked account' },
        { key: 'hacked', titleVi: 'Tài khoản bị xâm phạm', titleEn: 'Hacked account' },
      ],
      quickActions: [
        { labelVi: 'Đặt lại mật khẩu', labelEn: 'Reset password' },
        { labelVi: 'Tài khoản bị khóa', labelEn: 'Account locked' },
      ],
      articles: [
        {
          id: 'locked-acc',
          titleVi: 'Tài khoản Fakebook của tôi đã bị khóa',
          titleEn: 'My Fakebook account has been locked',
          section: 'locked',
          contentVi: (
            <div>
              <p>Nếu tài khoản của bạn bị khóa, hãy làm theo hướng dẫn trên màn hình để xác minh danh tính.</p>
              <ul>
                <li>Khi đăng nhập, bạn sẽ thấy thông báo tài khoản bị khóa và hướng dẫn xác minh.</li>
                <li>Chọn phương thức xác minh: xác minh qua email, SMS hoặc tải lên giấy tờ tùy thân.</li>
                <li>Làm theo hướng dẫn từng bước trên màn hình.</li>
                <li>Đợi Fakebook xử lý yêu cầu (có thể mất vài ngày).</li>
                <li>Kiểm tra email để nhận kết quả xác minh.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Quá trình xác minh danh tính có thể mất vài ngày đến vài tuần tùy thuộc vào phương thức bạn chọn.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>If your account has been locked, follow the on-screen instructions to verify your identity.</p>
              <ul>
                <li>When you log in, you'll see a notification that your account is locked with verification instructions.</li>
                <li>Choose a verification method: verify via email, SMS, or upload an identity document.</li>
                <li>Follow the step-by-step instructions on screen.</li>
                <li>Wait for Fakebook to process your request (this may take a few days).</li>
                <li>Check your email for the verification result.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> The identity verification process may take a few days to a few weeks depending on the method you choose.
              </div>
            </div>
          ),
        },
        {
          id: 'hacked-acc',
          titleVi: 'Tài khoản Fakebook của tôi bị xâm phạm',
          titleEn: 'My Fakebook account has been hacked',
          section: 'hacked',
          contentVi: (
            <div>
              <p>Nếu bạn nghi ngờ tài khoản Fakebook đã bị xâm phạm, hãy thực hiện các bước sau để khôi phục và bảo mật tài khoản.</p>
              <ul>
                <li>Truy cập trang khôi phục tài khoản tại fakebook.com/hacked.</li>
                <li>Nhập email hoặc số điện thoại liên kết với tài khoản.</li>
                <li>Làm theo hướng dẫn để đặt lại mật khẩu ngay lập tức.</li>
                <li>Kiểm tra và xóa các email hoặc ứng dụng bên thứ ba đáng ngờ có quyền truy cập tài khoản.</li>
                <li>Bật xác thực hai yếu tố (2FA) để bảo vệ tài khoản tốt hơn.</li>
                <li>Kiểm tra lịch sử hoạt động và đăng xuất khỏi các thiết bị lạ.</li>
              </ul>
              <div className="help-callout">
                <strong>Hành động quan trọng:</strong> Sau khi khôi phục tài khoản, hãy thay đổi mật khẩu ngay và bật 2FA để ngăn chặn xâm phạm trong tương lai.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>If you suspect your Fakebook account has been hacked, take these steps to recover and secure it.</p>
              <ul>
                <li>Go to the account recovery page at fakebook.com/hacked.</li>
                <li>Enter the email or phone number linked to your account.</li>
                <li>Follow the instructions to reset your password immediately.</li>
                <li>Check and remove any suspicious third-party emails or apps with account access.</li>
                <li>Enable two-factor authentication (2FA) for better protection.</li>
                <li>Review login activity and log out from unfamiliar devices.</li>
              </ul>
              <div className="help-callout">
                <strong>Critical action:</strong> After recovering your account, change your password immediately and enable 2FA to prevent future hacks.
              </div>
            </div>
          ),
        },
        {
          id: 'suspended-acc',
          titleVi: 'Tài khoản Fakebook bị đình chỉ',
          titleEn: 'Suspended Fakebook account',
          section: 'locked',
          contentVi: (
            <div>
              <p>Tài khoản Fakebook có thể bị đình chỉ nếu vi phạm Tiêu chuẩn cộng đồng hoặc Điều khoản dịch vụ.</p>
              <ul>
                <li>Khi đăng nhập, bạn sẽ thấy thông báo giải thích lý do đình chỉ.</li>
                <li>Nếu bạn cho rằng quyết định là nhầm lẫn, hãy nhấn "Kháng cáo" để gửi yêu cầu xem xét lại.</li>
                <li>Cung cấp thông tin và giải thích rõ ràng trong đơn kháng cáo.</li>
                <li>Đợi Fakebook xem xét đơn kháng cáo (có thể mất vài ngày).</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Trong quá trình kháng cáo, hãy đảm bảo bạn đã đọc kỹ Tiêu chuẩn cộng đồng để hiểu rõ các chính sách của Fakebook.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Your Fakebook account may be suspended for violating Community Standards or Terms of Service.</p>
              <ul>
                <li>When you log in, you'll see a notification explaining the reason for suspension.</li>
                <li>If you believe the decision was made in error, click "Appeal" to submit a review request.</li>
                <li>Provide information and a clear explanation in your appeal.</li>
                <li>Wait for Fakebook to review your appeal (this may take a few days).</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> While your appeal is being reviewed, make sure you have read the Community Standards to understand Fakebook's policies.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Tài khoản bị khóa', labelEn: 'Locked account' },
        { labelVi: 'Không nhận được mã xác thực', labelEn: 'Not receiving verification code' },
      ],
    },
    'account-settings': {
      bannerDescVi: 'Quản lý cài đặt tài khoản Fakebook của bạn.',
      bannerDescEn: 'Manage your Fakebook account settings.',
      sections: [
        { key: 'name', titleVi: 'Tên', titleEn: 'Name' },
        { key: 'email', titleVi: 'Email và liên hệ', titleEn: 'Email and contact' },
      ],
      quickActions: [
        { labelVi: 'Chỉnh sửa tên', labelEn: 'Change name' },
        { labelVi: 'Quản lý email', labelEn: 'Manage email' },
      ],
      articles: [
        {
          id: 'change-name',
          titleVi: 'Thay đổi tên Fakebook',
          titleEn: 'Change your Fakebook name',
          section: 'name',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi tên Fakebook của mình trong Cài đặt.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Chung &gt; Tên.</li>
                <li>Nhập tên mới và nhấn "Xem lại thay đổi".</li>
                <li>Nhập mật khẩu để xác nhận và nhấn "Lưu thay đổi".</li>
              </ul>
              <div className="help-callout">
                <strong>Quy tắc đặt tên:</strong> Tên phải tuân thủ Tiêu chuẩn cộng đồng Fakebook. Không sử dụng tên giả, tên thương hiệu hoặc ký hiệu đặc biệt. Bạn chỉ có thể thay đổi tên một lần trong 60 ngày.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change your Fakebook name in Settings.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; General &gt; Name.</li>
                <li>Enter your new name and click "Review Change".</li>
                <li>Enter your password to confirm and click "Save changes".</li>
              </ul>
              <div className="help-callout">
                <strong>Naming rules:</strong> Your name must comply with Fakebook Community Standards. Do not use fake names, brand names, or special symbols. You can only change your name once every 60 days.
              </div>
            </div>
          ),
        },
        {
          id: 'change-email',
          titleVi: 'Thay đổi địa chỉ email trên Fakebook',
          titleEn: 'Change your email address on Fakebook',
          section: 'email',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi địa chỉ email liên kết với tài khoản Fakebook bất kỳ lúc nào.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Chung &gt; Liên hệ.</li>
                <li>Nhấn "Chỉnh sửa" bên cạnh email hiện tại.</li>
                <li>Nhập email mới và nhấn "Thêm email".</li>
                <li>Kiểm tra hộp thư email mới để nhận mã xác thực và nhập mã vào Fakebook.</li>
                <li>Sau khi xác nhận, email mới sẽ được đặt làm email chính.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Đảm bảo bạn có quyền truy cập vào email mới trước khi thay đổi. Nếu không, bạn có thể bị khóa tài khoản.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change the email address linked to your Fakebook account at any time.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; General &gt; Contact.</li>
                <li>Click "Edit" next to your current email.</li>
                <li>Enter a new email and click "Add email".</li>
                <li>Check your new email inbox for a verification code and enter it on Fakebook.</li>
                <li>After confirmation, the new email will be set as your primary email.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> Make sure you have access to the new email before changing. Otherwise, you could be locked out of your account.
              </div>
            </div>
          ),
        },
        {
          id: 'change-phone',
          titleVi: 'Thay đổi số điện thoại trên Fakebook',
          titleEn: 'Change your phone number on Fakebook',
          section: 'email',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi số điện thoại liên kết với tài khoản Fakebook để nhận thông báo và mã xác thực.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Chung &gt; Liên hệ.</li>
                <li>Nhấn "Chỉnh sửa" bên cạnh số điện thoại hiện tại.</li>
                <li>Nhập số điện thoại mới và nhấn "Thêm số điện thoại".</li>
                <li>Nhập mã xác thực 6 chữ số được gửi đến số điện thoại mới.</li>
                <li>Sau khi xác nhận, số điện thoại mới sẽ được cập nhật.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change the phone number linked to your Fakebook account for notifications and verification codes.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; General &gt; Contact.</li>
                <li>Click "Edit" next to your current phone number.</li>
                <li>Enter a new phone number and click "Add phone number".</li>
                <li>Enter the 6-digit verification code sent to your new number.</li>
                <li>After confirmation, your new phone number will be updated.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Thay đổi tên', labelEn: 'Change name' },
        { labelVi: 'Quản lý email', labelEn: 'Manage email' },
      ],
    },
    'preferences': {
      bannerDescVi: 'Tùy chỉnh trải nghiệm Fakebook theo sở thích của bạn.',
      bannerDescEn: 'Customise your Fakebook experience to your preferences.',
      sections: [
        { key: 'language', titleVi: 'Ngôn ngữ', titleEn: 'Language' },
        { key: 'accessibility', titleVi: 'Truy cập', titleEn: 'Accessibility' },
      ],
      quickActions: [
        { labelVi: 'Ngôn ngữ', labelEn: 'Language' },
        { labelVi: 'Chế độ tối', labelEn: 'Dark mode' },
      ],
      articles: [
        {
          id: 'language',
          titleVi: 'Thay đổi ngôn ngữ trên Fakebook',
          titleEn: 'Change language on Fakebook',
          section: 'language',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi ngôn ngữ hiển thị trong Cài đặt.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Ngôn ngữ.</li>
                <li>Chọn ngôn ngữ bạn muốn sử dụng từ danh sách.</li>
                <li>Nhấn "Lưu thay đổi" để áp dụng ngôn ngữ mới.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Thay đổi ngôn ngữ sẽ ảnh hưởng đến toàn bộ giao diện Fakebook, bao gồm menu, thông báo và nội dung hiển thị.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change the display language in Settings.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Language.</li>
                <li>Select your preferred language from the list.</li>
                <li>Click "Save changes" to apply the new language.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> Changing the language affects the entire Fakebook interface, including menus, notifications, and displayed content.
              </div>
            </div>
          ),
        },
        {
          id: 'dark-mode',
          titleVi: 'Bật chế độ tối trên Fakebook',
          titleEn: 'Enable dark mode on Fakebook',
          section: 'accessibility',
          contentVi: (
            <div>
              <p>Chế độ tối giúp giảm mỏi mắt khi sử dụng Fakebook trong môi trường thiếu sáng.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Chế độ tối.</li>
                <li>Chọn "Bật" để kích hoạt chế độ tối.</li>
                <li>Bạn cũng có thể đặt chế độ tối theo hệ thống thiết bị hoặc tự động theo thời gian trong ngày.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Dark mode reduces eye strain when using Fakebook in low-light environments.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Dark Mode.</li>
                <li>Select "On" to enable dark mode.</li>
                <li>You can also set dark mode to follow your device's system setting or automatically based on time of day.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'accessibility',
          titleVi: 'Cài đặt trợ năng trên Fakebook',
          titleEn: 'Accessibility settings on Fakebook',
          section: 'accessibility',
          contentVi: (
            <div>
              <p>Fakebook cung cấp các tính năng trợ giúp cho người dùng có nhu cầu đặc biệt.</p>
              <ul>
                <li><strong>Đọc màn hình:</strong> Fakebook tương thích với trình đọc màn hình như VoiceOver (iOS) và TalkBack (Android).</li>
                <li><strong>Độ tương phản cao:</strong> Bật chế độ tương phản cao để cải thiện khả năng hiển thị nội dung.</li>
                <li><strong>Phụ đề:</strong> Bật phụ đề tự động cho video để theo dõi nội dung âm thanh.</li>
                <li><strong>Thay đổi kích thước văn bản:</strong> Điều chỉnh cỡ chữ trong phần cài đặt thiết bị để phù hợp với nhu cầu của bạn.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook provides assistive features for users with special needs.</p>
              <ul>
                <li><strong>Screen readers:</strong> Fakebook is compatible with screen readers like VoiceOver (iOS) and TalkBack (Android).</li>
                <li><strong>High contrast:</strong> Enable high contrast mode to improve content visibility.</li>
                <li><strong>Captions:</strong> Turn on automatic captions for videos to follow audio content.</li>
                <li><strong>Text size:</strong> Adjust text size in your device settings to suit your needs.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Thay đổi ngôn ngữ', labelEn: 'Change language' },
      ],
    },
    'notifications': {
      bannerDescVi: 'Quản lý thông báo Fakebook theo nhu cầu của bạn.',
      bannerDescEn: 'Manage Fakebook notifications to suit your needs.',
      sections: [
        { key: 'manage', titleVi: 'Quản lý thông báo', titleEn: 'Manage notifications' },
        { key: 'types', titleVi: 'Loại thông báo', titleEn: 'Notification types' },
      ],
      quickActions: [
        { labelVi: 'Tắt thông báo', labelEn: 'Turn off notifications' },
        { labelVi: 'Cài đặt thông báo', labelEn: 'Notification settings' },
      ],
      articles: [
        {
          id: 'manage-notif',
          titleVi: 'Quản lý cài đặt thông báo',
          titleEn: 'Manage notification settings',
          section: 'manage',
          contentVi: (
            <div>
              <p>Bạn có thể tùy chỉnh loại thông báo muốn nhận trong Cài đặt.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Thông báo.</li>
                <li>Chọn loại thông báo bạn muốn bật hoặc tắt (bình luận, lượt thích, lời mời kết bạn,...).</li>
                <li>Điều chỉnh tần suất thông báo: tức thì, hàng ngày hoặc hàng tuần.</li>
                <li>Chọn phương thức nhận thông báo: push, email hoặc SMS.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can customise which notifications you receive in Settings.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Notifications.</li>
                <li>Choose which notifications to enable or disable (comments, likes, friend requests, ...).</li>
                <li>Adjust notification frequency: instant, daily, or weekly.</li>
                <li>Choose notification delivery method: push, email, or SMS.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'push-notif',
          titleVi: 'Các loại thông báo trên Fakebook',
          titleEn: 'Types of notifications on Fakebook',
          section: 'types',
          contentVi: (
            <div>
              <p>Fakebook gửi nhiều loại thông báo khác nhau để giúp bạn cập nhật.</p>
              <ul>
                <li><strong>Thông báo push:</strong> Thông báo trên thiết bị di động hoặc máy tính khi có hoạt động mới.</li>
                <li><strong>Thông báo email:</strong> Tóm tắt hoạt động quan trọng gửi đến hộp thư email của bạn.</li>
                <li><strong>Thông báo SMS:</strong> Tin nhắn văn bản với mã xác thực hoặc thông báo bảo mật quan trọng.</li>
                <li><strong>Thông báo trong ứng dụng:</strong> Hiển thị trong phần "Thông báo" trên Fakebook.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook sends various types of notifications to keep you updated.</p>
              <ul>
                <li><strong>Push notifications:</strong> Alerts on your mobile device or computer for new activity.</li>
                <li><strong>Email notifications:</strong> Summary of important activity sent to your email inbox.</li>
                <li><strong>SMS notifications:</strong> Text messages with verification codes or important security alerts.</li>
                <li><strong>In-app notifications:</strong> Displayed in the "Notifications" section on Fakebook.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'notif-sound',
          titleVi: 'Tùy chỉnh âm thanh thông báo',
          titleEn: 'Customise notification sounds',
          section: 'manage',
          contentVi: (
            <div>
              <p>Bạn có thể thay đổi âm thanh thông báo để phân biệt giữa các loại thông báo khác nhau.</p>
              <ul>
                <li>Trên thiết bị di động: đi tới Cài đặt thiết bị &gt; Ứng dụng &gt; Fakebook &gt; Thông báo &gt; Âm thanh.</li>
                <li>Chọn âm thanh mới từ danh sách âm có sẵn trên thiết bị.</li>
                <li>Để tắt âm thanh thông báo: chọn "Không có âm thanh" hoặc "Im lặng".</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can change notification sounds to differentiate between different types of notifications.</p>
              <ul>
                <li>On mobile: go to your device Settings &gt; Apps &gt; Fakebook &gt; Notifications &gt; Sound.</li>
                <li>Select a new sound from the list of available sounds on your device.</li>
                <li>To mute notification sounds: select "None" or "Silent".</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Quản lý thông báo', labelEn: 'Manage notifications' },
      ],
    },
    'privacy-settings': {
      bannerDescVi: 'Kiểm soát ai có thể thấy thông tin và bài viết của bạn.',
      bannerDescEn: 'Control who can see your information and posts.',
      sections: [
        { key: 'audience', titleVi: 'Đối tượng', titleEn: 'Audience' },
        { key: 'visibility', titleVi: 'Tầm nhìn', titleEn: 'Visibility' },
      ],
      quickActions: [
        { labelVi: 'Kiểm tra quyền riêng tư', labelEn: 'Review privacy settings' },
        { labelVi: 'Đối tượng bài viết', labelEn: 'Post audience' },
      ],
      articles: [
        {
          id: 'who-sees',
          titleVi: 'Ai có thể thấy bài viết của tôi?',
          titleEn: 'Who can see my posts?',
          section: 'audience',
          contentVi: (
            <div>
              <p>Bạn có thể chọn đối tượng cho từng bài viết: Công khai, Bạn bè, Chỉ mình tôi, hoặc nhóm tùy chỉnh.</p>
              <ul>
                <li><strong>Công khai:</strong> Bất kỳ ai trên Fakebook đều có thể thấy bài viết.</li>
                <li><strong>Bạn bè:</strong> Chỉ bạn bè trên Fakebook mới thấy bài viết.</li>
                <li><strong>Chỉ mình tôi:</strong> Chỉ bạn mới thấy bài viết này.</li>
                <li><strong>Nhóm tùy chỉnh:</strong> Chọn nhóm bạn bè cụ thể để chia sẻ.</li>
                <li>Bạn có thể thay đổi đối tượng bài viết bất kỳ lúc nào sau khi đăng.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can choose the audience for each post: Public, Friends, Only me, or custom lists.</p>
              <ul>
                <li><strong>Public:</strong> Anyone on Fakebook can see the post.</li>
                <li><strong>Friends:</strong> Only your Fakebook friends can see the post.</li>
                <li><strong>Only me:</strong> Only you can see this post.</li>
                <li><strong>Custom lists:</strong> Choose specific friend groups to share with.</li>
                <li>You can change a post's audience at any time after posting.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'profile-visibility',
          titleVi: 'Ai có thể tìm thấy bạn trên Fakebook',
          titleEn: 'Who can find you on Fakebook',
          section: 'visibility',
          contentVi: (
            <div>
              <p>Bạn có thể kiểm soát khả năng tìm thấy tài khoản Fakebook của mình bởi người khác.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Quyền riêng tư &gt; Ai có thể tìm bạn.</li>
                <li>Chọn ai có thể tìm bạn bằng email: Bạn bè, Mọi người hoặc Chỉ mình tôi.</li>
                <li>Chọn ai có thể tìm bạn bằng số điện thoại: Bạn bè, Mọi người hoặc Chỉ mình tôi.</li>
                <li>Để ẩn hoàn toàn: chọn "Chỉ mình tôi" cho cả email và số điện thoại.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You can control how discoverable your Fakebook account is to others.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Privacy &gt; Who can find you.</li>
                <li>Choose who can find you by email: Friends, Everyone, or Only me.</li>
                <li>Choose who can find you by phone number: Friends, Everyone, or Only me.</li>
                <li>To be fully hidden: select "Only me" for both email and phone number.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'search-engine',
          titleVi: 'Liên kết công cụ tìm kiếm và Fakebook',
          titleEn: 'Search engine linking and Fakebook',
          section: 'visibility',
          contentVi: (
            <div>
              <p>Các công cụ tìm kiếm như Google có thể hiển thị trang cá nhân Fakebook của bạn trong kết quả tìm kiếm.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Quyền riêng tư.</li>
                <li>Tìm mục "Công cụ tìm kiếm" và tắt tùy chọn "Cho phép công cụ tìm kiếm bên ngoài liên kết đến trang cá nhân của bạn".</li>
                <li>Sau khi tắt, trang cá nhân của bạn sẽ không xuất hiện trong kết quả tìm kiếm bên ngoài Fakebook.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Thay đổi này có thể mất vài tuần để có hiệu lực trên tất cả các công cụ tìm kiếm.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Search engines like Google may display your Fakebook profile in search results.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Privacy.</li>
                <li>Find the "Search engines" section and turn off "Allow search engines outside Fakebook to link to your profile".</li>
                <li>After turning this off, your profile will no longer appear in search results outside Fakebook.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> This change may take a few weeks to take effect on all search engines.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Kiểm tra quyền riêng tư', labelEn: 'Check your privacy settings' },
        { labelVi: 'Đối tượng bài viết', labelEn: 'Post audience' },
      ],
    },
    safety: {
      bannerDescVi: 'Giữ an toàn trên Fakebook với các công cụ bảo vệ.',
      bannerDescEn: 'Stay safe on Fakebook with protection tools.',
      sections: [
        { key: 'block', titleVi: 'Chặn', titleEn: 'Blocking' },
        { key: 'report', titleVi: 'Báo cáo', titleEn: 'Reporting' },
      ],
      quickActions: [
        { labelVi: 'Chặn người dùng', labelEn: 'Block someone' },
        { labelVi: 'Báo cáo', labelEn: 'Report something' },
      ],
      articles: [
        {
          id: 'block-user',
          titleVi: 'Chặn người dùng trên Fakebook',
          titleEn: 'Block someone on Fakebook',
          section: 'block',
          contentVi: (
            <div>
              <p>Khi chặn ai đó, họ sẽ không thể xem trang cá nhân, gửi tin nhắn hoặc kết bạn với bạn trên Fakebook.</p>
              <ul>
                <li>Truy cập trang cá nhân của người mà bạn muốn chặn.</li>
                <li>Nhấn nút ba chấm (...) và chọn "Chặn".</li>
                <li>Xác nhận chặn trong hộp thoại hiển thị.</li>
              </ul>
              <p>Bạn có thể quản lý danh sách chặn trong Cài đặt &gt; Quyền riêng tư &gt; Chặn.</p>
            </div>
          ),
          contentEn: (
            <div>
              <p>When you block someone, they won't be able to see your profile, send you messages, or add you as a friend on Fakebook.</p>
              <ul>
                <li>Go to the profile of the person you want to block.</li>
                <li>Click the three-dot menu (...) and select "Block".</li>
                <li>Confirm the block in the dialog box.</li>
              </ul>
              <p>You can manage your blocked list in Settings &gt; Privacy &gt; Blocking.</p>
            </div>
          ),
        },
        {
          id: 'report-content',
          titleVi: 'Báo cáo nội dung trên Fakebook',
          titleEn: 'Report content on Fakebook',
          section: 'report',
          contentVi: (
            <div>
              <p>Báo cáo giúp Fakebook phát hiện và xử lý nội dung vi phạm Tiêu chuẩn cộng đồng.</p>
              <ul>
                <li><strong>Báo cáo bài viết:</strong> Nhấn nút ba chấm (...) trên bài viết &gt; "Báo cáo" &gt; Chọn lý do phù hợp.</li>
                <li><strong>Báo cáo bình luận:</strong> Nhấn giữ bình luận &gt; "Báo cáo" &gt; Chọn lý do.</li>
                <li><strong>Báo cáo trang cá nhân:</strong> Truy cập trang cá nhân &gt; Nhấn ba chấm (...) &gt; "Báo cáo" &gt; Chọn lý do.</li>
                <li>Sau khi báo cáo, Fakebook sẽ xem xét và phản hồi qua email.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Reporting helps Fakebook detect and handle content that violates Community Standards.</p>
              <ul>
                <li><strong>Report a post:</strong> Click the three-dot menu (...) on the post &gt; "Report" &gt; Choose the appropriate reason.</li>
                <li><strong>Report a comment:</strong> Long-press the comment &gt; "Report" &gt; Choose a reason.</li>
                <li><strong>Report a profile:</strong> Go to the profile &gt; Click the three-dot menu (...) &gt; "Report" &gt; Choose a reason.</li>
                <li>After reporting, Fakebook will review and respond via email.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'safety-tips',
          titleVi: 'Mẹo an toàn trên Fakebook',
          titleEn: 'Safety tips on Fakebook',
          section: 'block',
          contentVi: (
            <div>
              <p>Bảo vệ bản thân và thông tin cá nhân khi sử dụng Fakebook.</p>
              <ul>
                <li><strong>Không chia sẻ mật khẩu:</strong> Không bao giờ chia sẻ mật khẩu Fakebook với bất kỳ ai.</li>
                <li><strong>Bật 2FA:</strong> Sử dụng xác thực hai yếu tố để bảo vệ tài khoản.</li>
                <li><strong>Cẩn thận với tin nhắn lạ:</strong> Không nhấp vào liên kết đáng ngờ trong tin nhắn hoặc bình luận.</li>
                <li><strong>Kiểm tra quyền riêng tư:</strong> Định kỳ xem lại ai có thể thấy bài viết và thông tin cá nhân của bạn.</li>
                <li><strong>Báo cáo ngay:</strong> Nếu phát hiện tài khoản giả mạo hoặc nội dung đáng ngờ, hãy báo cáo ngay lập tức.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Protect yourself and your personal information when using Fakebook.</p>
              <ul>
                <li><strong>Never share your password:</strong> Do not share your Fakebook password with anyone.</li>
                <li><strong>Enable 2FA:</strong> Use two-factor authentication to protect your account.</li>
                <li><strong>Be cautious of strange messages:</strong> Do not click on suspicious links in messages or comments.</li>
                <li><strong>Check your privacy:</strong> Regularly review who can see your posts and personal information.</li>
                <li><strong>Report immediately:</strong> If you find a fake account or suspicious content, report it right away.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Chặn người dùng', labelEn: 'Block someone' },
        { labelVi: 'Báo cáo lạm dụng', labelEn: 'Report abuse' },
      ],
    },
    'community-standards': {
      bannerDescVi: 'Tiêu chuẩn cộng đồng định hướng những gì được phép và không được phép trên Fakebook.',
      bannerDescEn: "Community Standards set out what is and isn't allowed on Fakebook.",
      sections: [
        { key: 'overview', titleVi: 'Tổng quan', titleEn: 'Overview' },
        { key: 'policies', titleVi: 'Chính sách', titleEn: 'Policies' },
      ],
      quickActions: [
        { labelVi: 'Đọc Tiêu chuẩn', labelEn: 'Read the Standards' },
      ],
      articles: [
        {
          id: 'standards-overview',
          titleVi: 'Tổng quan Tiêu chuẩn cộng đồng',
          titleEn: 'Community Standards overview',
          section: 'overview',
          contentVi: (
            <div>
              <p>Tiêu chuẩn cộng đồng giúp giữ Fakebook an toàn cho tất cả mọi người.</p>
              <ul>
                <li><strong>An toàn:</strong> Ngăn chặn bạo lực, tự tử, buôn người và các mối đe dọa an toàn khác.</li>
                <li><strong>Bình đẳng:</strong> Chống phân biệt đối xử, ngôn ngữ thù ghét và bắt nạt.</li>
                <li><strong>Chính trực:</strong> Ngăn chặn thông tin sai lệch, thư rác và hành vi gian lận.</li>
                <li><strong>Quyền riêng tư:</strong> Bảo vệ thông tin cá nhân và quyền riêng tư của người dùng.</li>
                <li><strong>Nội dung:</strong> Quản lý nội dung khiêu dâm, bạo lực và độc hại.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Community Standards help keep Fakebook safe for everyone.</p>
              <ul>
                <li><strong>Safety:</strong> Prevent violence, suicide, human trafficking, and other safety threats.</li>
                <li><strong>Equity:</strong> Combat discrimination, hate speech, and bullying.</li>
                <li><strong>Integrity:</strong> Prevent misinformation, spam, and fraudulent behaviour.</li>
                <li><strong>Privacy:</strong> Protect personal information and user privacy.</li>
                <li><strong>Content:</strong> Manage nudity, violence, and harmful content.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'violence',
          titleVi: 'Chính sách về bạo lực và tổ chức nguy hiểm',
          titleEn: 'Violence and dangerous organisations policy',
          section: 'policies',
          contentVi: (
            <div>
              <p>Fakebook nghiêm cấm mọi hình thức bạo lực và nội dung liên quan đến tổ chức nguy hiểm.</p>
              <ul>
                <li>Không đăng nội dung đe dọa bạo lực, kích động bạo lực hoặc ca ngợi bạo lực.</li>
                <li>Không chia sẻ nội dung liên quan đến tổ chức khủng bố hoặc cực đoan.</li>
                <li>Không đăng nội dung về buôn người, bóc lột hoặc Hurting người khác.</li>
              </ul>
              <div className="help-callout">
                <strong>Hậu quả:</strong> Vi phạm chính sách bạo lực có thể dẫn đến xóa nội dung, khóa tài khoản vĩnh viễn và báo cáo cho cơ quan chức năng.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook strictly prohibits all forms of violence and content related to dangerous organisations.</p>
              <ul>
                <li>Do not post content that threatens violence, incites violence, or glorifies violence.</li>
                <li>Do not share content related to terrorist or extremist organisations.</li>
                <li>Do not post content about human trafficking, exploitation, or harming others.</li>
              </ul>
              <div className="help-callout">
                <strong>Consequences:</strong> Violating the violence policy may result in content removal, permanent account suspension, and reports to law enforcement.
              </div>
            </div>
          ),
        },
        {
          id: 'hate-speech',
          titleVi: 'Chính sách ngôn ngữ thù ghét',
          titleEn: 'Hate speech policy',
          section: 'policies',
          contentVi: (
            <div>
              <p>Fakebook không cho phép ngôn ngữ thù ghét nhắm vào các nhóm dựa trên đặc điểm cá nhân.</p>
              <ul>
                <li>Không sử dụng ngôn ngữ xúc phạm, miệt thị hoặc kích động thù ghét针对任何 nhóm dựa trên chủng tộc, dân tộc, tôn giáo, giới tính, xu hướng tính dục, khuyết tật.</li>
                <li>Không đăng nội dung phủ nhận các sự kiện lịch sử nghiêm trọng như diệt chủng.</li>
                <li>Không sử dụng biểu tượng hoặc hình ảnh liên quan đến tổ chức thù ghét.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook does not allow hate speech targeting groups based on personal characteristics.</p>
              <ul>
                <li>Do not use offensive, derogatory, or inflammatory language targeting any group based on race, ethnicity, religion, gender, sexual orientation, or disability.</li>
                <li>Do not post content denying serious historical events such as genocide.</li>
                <li>Do not use symbols or images associated with hate organisations.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Tiêu chuẩn cộng đồng', labelEn: 'Community Standards' },
      ],
    },
    terms: {
      bannerDescVi: 'Điều khoản dịch vụ Fakebook quy định việc bạn sử dụng nền tảng.',
      bannerDescEn: 'Fakebook Terms of Service govern your use of the platform.',
      sections: [
        { key: 'overview', titleVi: 'Tổng quan', titleEn: 'Overview' },
        { key: 'your-content', titleVi: 'Nội dung của bạn', titleEn: 'Your content' },
      ],
      quickActions: [
        { labelVi: 'Đọc Điều khoản', labelEn: 'Read the Terms' },
      ],
      articles: [
        {
          id: 'terms-overview',
          titleVi: 'Tổng quan Điều khoản dịch vụ',
          titleEn: 'Terms of Service overview',
          section: 'overview',
          contentVi: (
            <div>
              <p>Điều khoản dịch vụ Fakebook bao gồm các quy tắc và hướng dẫn khi bạn sử dụng nền tảng.</p>
              <ul>
                <li>Bạn phải tuân thủ Tiêu chuẩn cộng đồng và Điều khoản dịch vụ.</li>
                <li>Bạn không được sử dụng Fakebook cho các hoạt động bất hợp pháp hoặc vi phạm pháp luật.</li>
                <li>Fakebook có quyền xóa nội dung và khóa tài khoản vi phạm.</li>
                <li>Bạn có trách nhiệm bảo mật tài khoản và mật khẩu.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>Fakebook Terms of Service cover the rules and guidelines when you use the platform.</p>
              <ul>
                <li>You must comply with Community Standards and Terms of Service.</li>
                <li>You must not use Fakebook for illegal activities or law violations.</li>
                <li>Fakebook reserves the right to remove content and suspend violating accounts.</li>
                <li>You are responsible for the security of your account and password.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'content-ownership',
          titleVi: 'Quyền sở hữu nội dung trên Fakebook',
          titleEn: 'Content ownership on Fakebook',
          section: 'your-content',
          contentVi: (
            <div>
              <p>Bạn giữ quyền sở hữu nội dung bạn tạo và chia sẻ trên Fakebook.</p>
              <ul>
                <li>Bạn sở hữu tất cả nội dung (ảnh, video, bài viết) mà bạn đăng trên Fakebook.</li>
                <li>Khi đăng nội dung, bạn cấp cho Fakebook giấy phép sử dụng, hiển thị và phân phối nội dung đó theo Điều khoản dịch vụ.</li>
                <li>Bạn có thể xóa nội dung bất kỳ lúc nào và giấy phép sẽ chấm dứt.</li>
                <li>Fakebook không bán nội dung của bạn cho bên thứ ba.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>You retain ownership of the content you create and share on Fakebook.</p>
              <ul>
                <li>You own all content (photos, videos, posts) you upload to Fakebook.</li>
                <li>When you post content, you grant Fakebook a licence to use, display, and distribute that content under the Terms of Service.</li>
                <li>You can delete your content at any time and the licence will terminate.</li>
                <li>Fakebook does not sell your content to third parties.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'account-deletion',
          titleVi: 'Xóa tài khoản Fakebook',
          titleEn: 'Delete your Fakebook account',
          section: 'overview',
          contentVi: (
            <div>
              <p>Khi bạn xóa tài khoản Fakebook, tất cả dữ liệu sẽ bị xóa vĩnh viễn.</p>
              <ul>
                <li>Đi tới Cài đặt &amp; Quyền riêng tư &gt; Cài đặt &gt; Thông tin của bạn &gt; Vô hiệu hóa và xóa.</li>
                <li>Chọn "Xóa tài khoản" và nhấn "Tiếp tục".</li>
                <li>Nhập mật khẩu để xác nhận và nhấn "Xóa tài khoản".</li>
                <li>Tài khoản sẽ bị vô hiệu hóa trong 30 ngày trước khi xóa vĩnh viễn.</li>
                <li>Trong vòng 30 ngày, bạn có thể khôi phục tài khoản bằng cách đăng nhập lại.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý quan trọng:</strong> Sau 30 ngày, tất cả dữ liệu (bài viết, ảnh, tin nhắn) sẽ bị xóa vĩnh viễn và không thể khôi phục.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>When you delete your Fakebook account, all data will be permanently deleted.</p>
              <ul>
                <li>Go to Settings &amp; Privacy &gt; Settings &gt; Your Information &gt; Deactivation and Deletion.</li>
                <li>Select "Delete account" and click "Continue".</li>
                <li>Enter your password to confirm and click "Delete account".</li>
                <li>Your account will be deactivated for 30 days before permanent deletion.</li>
                <li>Within 30 days, you can recover your account by logging back in.</li>
              </ul>
              <div className="help-callout">
                <strong>Important note:</strong> After 30 days, all data (posts, photos, messages) will be permanently deleted and cannot be recovered.
              </div>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Điều khoản dịch vụ', labelEn: 'Terms of Service' },
      ],
    },
    'report-content': {
      bannerDescVi: 'Báo cáo nội dung vi phạm Tiêu chuẩn cộng đồng trên Fakebook.',
      bannerDescEn: 'Report content that violates Fakebook Community Standards.',
      sections: [
        { key: 'how', titleVi: 'Cách báo cáo', titleEn: 'How to report' },
        { key: 'after', titleVi: 'Sau khi báo cáo', titleEn: 'After reporting' },
      ],
      quickActions: [
        { labelVi: 'Báo cáo bài viết', labelEn: 'Report a post' },
        { labelVi: 'Báo cáo trang cá nhân', labelEn: 'Report a profile' },
      ],
      articles: [
        {
          id: 'report-post',
          titleVi: 'Báo cáo bài viết trên Fakebook',
          titleEn: 'Report a post on Fakebook',
          section: 'how',
          contentVi: (
            <div>
              <p>Để báo cáo bài viết, nhấp vào menu ba chấm (...) ở góc bài viết và chọn "Báo cáo".</p>
              <ul>
                <li>Nhấn nút ba chấm (...) ở góc trên bên phải của bài viết.</li>
                <li>Chọn "Báo cáo" từ menu thả xuống.</li>
                <li>Chọn lý do báo cáo phù hợp (ví dụ: bạo lực, phân biệt đối xử, nội dung giả mạo,...).</li>
                <li>Cung cấp thông tin bổ sung nếu được yêu cầu.</li>
                <li>Nhấn "Gửi báo cáo" để hoàn tất.</li>
              </ul>
              <div className="help-callout">
                <strong>Lưu ý:</strong> Báo cáo là ẩn danh và người đăng bài viết sẽ không biết ai đã báo cáo.
              </div>
            </div>
          ),
          contentEn: (
            <div>
              <p>To report a post, click the three-dot menu (...) at the top of the post and select "Report".</p>
              <ul>
                <li>Click the three-dot menu (...) at the top-right corner of the post.</li>
                <li>Select "Report" from the dropdown menu.</li>
                <li>Choose the appropriate reporting reason (e.g., violence, discrimination, fake content, ...).</li>
                <li>Provide additional information if requested.</li>
                <li>Click "Submit report" to complete.</li>
              </ul>
              <div className="help-callout">
                <strong>Note:</strong> Reports are anonymous and the post author will not know who reported them.
              </div>
            </div>
          ),
        },
        {
          id: 'report-profile',
          titleVi: 'Báo cáo trang cá nhân trên Fakebook',
          titleEn: 'Report a profile on Fakebook',
          section: 'how',
          contentVi: (
            <div>
              <p>Nếu bạn phát hiện trang cá nhân giả mạo hoặc vi phạm, hãy báo cáo ngay.</p>
              <ul>
                <li>Truy cập trang cá nhân mà bạn muốn báo cáo.</li>
                <li>Nhấn nút ba chấm (...) bên cạnh nút "Nhắn tin".</li>
                <li>Chọn "Báo cáo" và chọn lý do phù hợp.</li>
                <li>Làm theo hướng dẫn trên màn hình để hoàn tất báo cáo.</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>If you find a fake or violating profile, report it immediately.</p>
              <ul>
                <li>Go to the profile you want to report.</li>
                <li>Click the three-dot menu (...) next to the "Message" button.</li>
                <li>Select "Report" and choose the appropriate reason.</li>
                <li>Follow the on-screen instructions to complete the report.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'report-outcome',
          titleVi: 'Xảy ra gì sau khi báo cáo',
          titleEn: 'What happens after reporting',
          section: 'after',
          contentVi: (
            <div>
              <p>Sau khi bạn báo cáo nội dung, Fakebook sẽ xem xét và xử lý theo các bước sau:</p>
              <ul>
                <li>Fakebook sẽ kiểm tra nội dung được báo cáo trong vòng 24-48 giờ.</li>
                <li>Nếu nội dung vi phạm, nó sẽ bị xóa hoặc hạn chế hiển thị.</li>
                <li>Bạn sẽ nhận được email thông báo kết quả báo cáo.</li>
                <li>Nếu người vi phạm nhiều lần, tài khoản của họ có thể bị khóa.</li>
                <li>Bạn có thể theo dõi trạng thái báo cáo trong mục "Báo cáo đã gửi".</li>
              </ul>
            </div>
          ),
          contentEn: (
            <div>
              <p>After you report content, Fakebook will review and process it through these steps:</p>
              <ul>
                <li>Fakebook will review the reported content within 24-48 hours.</li>
                <li>If the content violates policies, it will be removed or have its reach restricted.</li>
                <li>You will receive an email notification with the report outcome.</li>
                <li>If the violator is a repeat offender, their account may be suspended.</li>
                <li>You can track the report status in the "Sent Reports" section.</li>
              </ul>
            </div>
          ),
        },
      ],
      popularArticles: [
        { labelVi: 'Báo cáo bài viết', labelEn: 'Report a post' },
        { labelVi: 'Báo cáo trang cá nhân', labelEn: 'Report a profile' },
      ],
    },
  }

  return (
    contents[key] || {
      bannerDescVi: '',
      bannerDescEn: '',
      quickActions: [],
      articles: [],
      popularArticles: [],
    }
  )
}

function findNavItem(key: string, items: NavItem[] = NAV_ITEMS): NavItem | undefined {
  for (const item of items) {
    if (item.key === key) return item
    if (item.children) {
      const found = findNavItem(key, item.children)
      if (found) return found
    }
  }
  return undefined
}

function findBreadcrumbPath(key: string, items: NavItem[] = NAV_ITEMS, path: NavItem[] = []): NavItem[] | null {
  for (const item of items) {
    if (item.key === key) return [...path, item]
    if (item.children) {
      const result = findBreadcrumbPath(key, item.children, [...path, item])
      if (result) return result
    }
  }
  return null
}

export function HelpPage({ onBack, initialTopic = 'creating-account' }: HelpPageProps) {
  const { locale, setLocale } = useI18n()
  const isVi = locale === 'vi'

  const [viewMode, setViewMode] = useState<ViewMode>(
    initialTopic === 'home' ? 'home' : 'category'
  )
  const [activeKey, setActiveKey] = useState<string>(initialTopic)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'using-facebook': true,
  })
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({})
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleSubItem = (key: string) => {
    setExpandedSubItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleArticle = (id: string) => {
    setExpandedArticles((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const navigateTo = (key: string) => {
    const item = findNavItem(key)
    if (item?.children && item.children.length > 0) {
      toggleSubItem(key)
    } else {
      setActiveKey(key)
      setViewMode('category')
    }
  }

  const navigateHome = () => {
    setViewMode('home')
    setActiveKey('home')
  }

  const breadcrumbPath = useMemo(() => {
    if (activeKey === 'home') return []
    return findBreadcrumbPath(activeKey) || []
  }, [activeKey])

  const categoryContent = useMemo(() => {
    if (activeKey === 'home') return null
    return getCategoryContent(activeKey)
  }, [activeKey])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const results: { key: string; label: string; group: string }[] = []

    const searchItems = (items: NavItem[], groupLabel: string) => {
      for (const item of items) {
        const label = isVi ? item.labelVi : item.labelEn
        if (label.toLowerCase().includes(q)) {
          results.push({ key: item.key, label, group: groupLabel })
        }
        if (item.children) searchItems(item.children, groupLabel)
      }
    }

    for (const group of NAV_ITEMS) {
      const groupLabel = isVi ? group.labelVi : group.labelEn
      searchItems(group.children || [], groupLabel)
    }

    return results
  }, [searchQuery, isVi])

  const topicCards = useMemo(() => [
    {
      key: 'account-settings',
      icon: <FaCog />,
      titleVi: 'Cài đặt tài khoản',
      titleEn: 'Account settings',
      descVi: 'Điều chỉnh cài đặt, quản lý thông báo, tìm hiểu về thay đổi tên và nhiều hơn nữa.',
      descEn: 'Adjust settings, manage notifications, learn about name changes and more.',
      bg: '#e7f3ff',
      color: '#1877f2',
    },
    {
      key: 'login-password',
      icon: <FaKey />,
      titleVi: 'Đăng nhập và mật khẩu',
      titleEn: 'Login and password',
      descVi: 'Khắc phục sự cố đăng nhập và tìm hiểu cách thay đổi hoặc đặt lại mật khẩu.',
      descEn: 'Fix login issues and learn how to change or reset your password.',
      bg: '#e7f3ff',
      color: '#1877f2',
    },
    {
      key: 'privacy-settings',
      icon: <FaShieldAlt />,
      titleVi: 'Quyền riêng tư và an toàn',
      titleEn: 'Privacy and security',
      descVi: 'Kiểm soát ai có thể thấy bạn chia sẻ gì và thêm biện pháp bảo vệ cho tài khoản.',
      descEn: 'Control who can see what you share and add extra protection to your account.',
      bg: '#e7f3ff',
      color: '#1877f2',
    },
    {
      key: 'friending',
      icon: <FaUsers />,
      titleVi: 'Kết bạn',
      titleEn: 'Friending',
      descVi: 'Tìm hiểu cách gửi và chấp nhận lời mời kết bạn, cũng như quản lý danh sách bạn bè.',
      descEn: 'Learn how to send and accept friend requests, and manage your friends list.',
      bg: '#f0f2f5',
      color: '#1877f2',
    },
    {
      key: 'messaging',
      icon: <FaComments />,
      titleVi: 'Nhắn tin',
      titleEn: 'Messaging',
      descVi: 'Gửi tin nhắn, ảnh, video và biểu tượng cảm xúc cho bạn bè.',
      descEn: 'Send messages, photos, videos, and emojis to your friends.',
      bg: '#f0f2f5',
      color: '#1877f2',
    },
    {
      key: 'privacy-safety',
      icon: <FaUserShield />,
      titleVi: 'Quyền riêng tư và an toàn',
      titleEn: 'Privacy and safety',
      descVi: 'Tìm hiểu cách bảo vệ tài khoản và giữ an toàn trên Fakebook.',
      descEn: 'Learn how to protect your account and stay safe on Fakebook.',
      bg: '#f0f2f5',
      color: '#1877f2',
    },
  ], [])

  const filteredTopicCards = useMemo(() => {
    if (!searchQuery.trim()) return topicCards
    const q = searchQuery.toLowerCase()
    return topicCards.filter(
      (card) =>
        (isVi ? card.titleVi : card.titleEn).toLowerCase().includes(q) ||
        (isVi ? card.descVi : card.descEn).toLowerCase().includes(q)
    )
  }, [searchQuery, isVi, topicCards])

  const renderNavItem = (item: NavItem, depth: number = 0) => {
    const label = isVi ? item.labelVi : item.labelEn
    const isActive = activeKey === item.key
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedGroups[item.key] ?? false
    const isSubExpanded = expandedSubItems[item.key] ?? false

    return (
      <div key={item.key}>
        <button
          type="button"
          className={`help-nav-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
          onClick={() => navigateTo(item.key)}
        >
          <span className="help-nav-icon" style={{ color: item.color }}>
            {item.icon}
          </span>
          <span className="help-nav-label">{label}</span>
          {hasChildren && (
            <span className={`help-nav-chevron ${(isExpanded || isSubExpanded) ? 'expanded' : ''}`}>
              <FaChevronDown />
            </span>
          )}
        </button>
        {hasChildren && (isExpanded || isSubExpanded) && (
          <div className="help-nav-sub-items">
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderHomeView = () => (
    <div className="help-home">
      <div className="help-home-logo">
        <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" width="64" height="64" style={{ borderRadius: '50%' }} />
      </div>

      <h1>{isVi ? 'Bạn cần giúp gì?' : 'Hey, how can I help?'}</h1>

      <div className="help-search-bar">
        <FaSearch />
        <input
          type="text"
          placeholder={isVi ? 'Đặt câu hỏi hoặc mô tả vấn đề của bạn...' : 'Ask a question or describe your issue...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {searchQuery.trim() && searchResults.length > 0 && (
        <div className="help-search-results">
          {searchResults.map((result) => (
            <button
              key={result.key}
              type="button"
              className="help-search-result-item"
              onClick={() => {
                navigateTo(result.key)
                setSearchQuery('')
              }}
            >
              <span className="help-search-result-label">{result.label}</span>
              <span className="help-search-result-group">{result.group}</span>
            </button>
          ))}
        </div>
      )}

      <div className="help-popular-section">
        <h2>{isVi ? 'Chủ đề phổ biến' : 'Popular topics'}</h2>

        <div className="help-featured-card" onClick={() => navigateTo('login-trouble')}>
          <div className="help-featured-icon">
            <FaKey />
          </div>
          <div className="help-featured-text">
            <h3>{isVi ? 'Cần giúp đăng nhập?' : 'Need help with logging in?'}</h3>
            <p>{isVi ? 'Tìm hiểu phải làm gì nếu bạn gặp sự cố khi đăng nhập Fakebook.' : "Learn what to do if you're having trouble with getting back on Fakebook."}</p>
          </div>
          <button type="button" className="help-featured-btn">
            {isVi ? 'Nhận giúp đỡ' : 'Get Help'}
          </button>
        </div>

        <div className="help-topic-grid">
          {filteredTopicCards.map((card) => (
            <div
              key={card.key}
              className="help-topic-card"
              onClick={() => navigateTo(card.key)}
            >
              <div className="help-topic-icon" style={{ background: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <h3>{isVi ? card.titleVi : card.titleEn}</h3>
              <p>{isVi ? card.descVi : card.descEn}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderCategoryView = () => {
    const item = findNavItem(activeKey)
    const content = categoryContent
    if (!item || !content) return null

    const label = isVi ? item.labelVi : item.labelEn
    const sections = content.sections

    const renderAccordionItem = (article: Article) => {
      const isOpen = expandedArticles[article.id] ?? false
      return (
        <div key={article.id} className="help-accordion-item">
          <button
            type="button"
            className="help-accordion-header"
            onClick={() => toggleArticle(article.id)}
          >
            <span>{isVi ? article.titleVi : article.titleEn}</span>
            <span className={`help-accordion-chevron ${isOpen ? 'expanded' : ''}`}>
              <FaChevronDown />
            </span>
          </button>
          {isOpen && (
            <div className="help-accordion-body">
              {isVi ? article.contentVi : article.contentEn}
            </div>
          )}
        </div>
      )
    }

    const renderArticleList = () => {
      if (sections && sections.length > 0) {
        return sections.map((section) => {
          const sectionArticles = content.articles.filter((a) => a.section === section.key)
          if (sectionArticles.length === 0) return null
          return (
            <div key={section.key} className="help-section">
              <h2 className="help-section-header">{isVi ? section.titleVi : section.titleEn}</h2>
              <div className="help-article-list">
                {sectionArticles.map(renderAccordionItem)}
              </div>
            </div>
          )
        })
      }

      const unsectioned = content.articles.filter((a) => !a.section)
      if (unsectioned.length > 0) {
        return (
          <div className="help-article-list">
            {unsectioned.map(renderAccordionItem)}
          </div>
        )
      }

      return (
        <div className="help-article-list">
          {content.articles.map(renderAccordionItem)}
        </div>
      )
    }

    return (
      <div className="help-category-view">
        <div className="help-breadcrumb">
          {breadcrumbPath.map((crumb, i) => (
            <span key={crumb.key}>
              {i > 0 && <FaChevronRight className="help-breadcrumb-sep" />}
              <button
                type="button"
                onClick={() => {
                  if (crumb.key === activeKey) return
                  if (crumb.children && crumb.children.length > 0) {
                    toggleSubItem(crumb.key)
                  } else {
                    setActiveKey(crumb.key)
                  }
                }}
              >
                {isVi ? crumb.labelVi : crumb.labelEn}
              </button>
            </span>
          ))}
        </div>

        <div className="help-category-header">
          <h1>{label}</h1>
        </div>

        {content.quickActions.length > 0 && (
          <div className="help-quick-actions">
            {content.quickActions.map((action) => (
              <button key={action.labelEn} type="button" className="help-quick-action">
                <FaLink />
                {isVi ? action.labelVi : action.labelEn}
              </button>
            ))}
          </div>
        )}

        {(isVi ? content.bannerDescVi : content.bannerDescEn) && (
          <div className="help-category-description">
            <p>{isVi ? content.bannerDescVi : content.bannerDescEn}</p>
          </div>
        )}

        {renderArticleList()}

        {content.popularArticles.length > 0 && (
          <div className="help-popular-articles">
            <h2>{isVi ? 'Bài viết phổ biến' : 'Popular articles'}</h2>
            <div className="help-popular-list">
              {content.popularArticles.map((pa) => (
                <button key={pa.labelEn} type="button" className="help-popular-item">
                  <span>{isVi ? pa.labelVi : pa.labelEn}</span>
                  <FaChevronRight />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="help-page">
      <header className="help-header">
        <button type="button" className="help-brand" onClick={navigateHome}>
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" width="32" height="32" style={{ borderRadius: '50%' }} />
          <span className="help-brand-text">{isVi ? 'Trung tâm hỗ trợ' : 'Help Centre'}</span>
        </button>

        <div className="help-header-spacer" />

        <div className="help-header-search">
          <FaSearch />
          <input
            type="text"
            placeholder={isVi ? 'Tìm kiếm bài viết hỗ trợ...' : 'Search help articles...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="help-header-actions">
          <select
            className="help-lang-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label="Language selector"
          >
            <option value="en">English (UK)</option>
            <option value="vi">Tiếng Việt</option>
          </select>

          {onBack && (
            <button type="button" className="help-back-btn" onClick={onBack}>
              {isVi ? 'Quay lại Fakebook' : 'Back to Fakebook'}
            </button>
          )}
        </div>
      </header>

      <div className="help-container">
        <aside className="help-sidebar">
          {NAV_ITEMS.map((group) => {
            const groupLabel = isVi ? group.labelVi : group.labelEn
            const isExpanded = expandedGroups[group.key] ?? false
            return (
              <div key={group.key} className="help-nav-group">
                <button
                  type="button"
                  className="help-nav-group-title"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="help-nav-icon" style={{ color: group.color }}>
                    {group.icon}
                  </span>
                  <span className="help-nav-label">{groupLabel}</span>
                  <span className={`help-nav-chevron ${isExpanded ? 'expanded' : ''}`}>
                    <FaChevronDown />
                  </span>
                </button>
                {isExpanded && group.children && (
                  <div className="help-nav-sub-items">
                    {group.children.map((child) => renderNavItem(child, 1))}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        <main className="help-content-area">
          {viewMode === 'home' ? renderHomeView() : renderCategoryView()}
        </main>
      </div>
    </div>
  )
}
