import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Locale } from '../i18n'
import {
  FaShieldAlt,
  FaDatabase,
  FaLock,
  FaSearch,
  FaTimes,
  FaChevronDown,
  FaChevronRight,
  FaComments,
  FaUserShield,
  FaUsers,
  FaUserLock,
  FaMobileAlt,
  FaDesktop,
  FaHome,
  FaArrowLeft,
  FaEye,
  FaUserCircle,
  FaUsersCog,
} from 'react-icons/fa'
import './PrivacyPage.css'

export interface PrivacyPageProps {
  onBack?: () => void
  initialTopic?: string
}

type TopicKey =
  | 'home'
  | 'sharing'
  | 'safety'
  | 'data'
  | 'cookies'
  | 'policy'
  | 'policy-what'
  | 'policy-info-collected'
  | 'policy-how-use'
  | 'policy-how-shared'
  | 'policy-third-party'
  | 'policy-meta-companies'
  | 'policy-manage-delete'
  | 'policy-retention'
  | 'policy-transfer'
  | 'policy-legal'
  | 'ad-choices'
  | 'community-standards'
  | 'terms'
  | 'data-policy'
  | 'cookie-policy'
  | 'request-removal'
  | 'account-deletion'

interface SearchableItem {
  id: string
  topic: TopicKey
  titleEn: string
  titleVi: string
  keywords: string[]
}

const SEARCH_ITEMS: SearchableItem[] = [
  { id: 'sharing', topic: 'sharing', titleEn: 'Sharing', titleVi: 'Chia sẻ', keywords: ['sharing', 'chia sẻ'] },
  { id: 'safety', topic: 'safety', titleEn: 'Safety', titleVi: 'An toàn', keywords: ['safety', 'an toàn'] },
  { id: 'data', topic: 'data', titleEn: 'Data', titleVi: 'Dữ liệu', keywords: ['data', 'dữ liệu'] },
  { id: 'cookies', topic: 'cookies', titleEn: 'Cookies', titleVi: 'Cookies', keywords: ['cookies'] },
  { id: 'policy', topic: 'policy', titleEn: 'Privacy Policy', titleVi: 'Chính sách quyền riêng tư', keywords: ['policy', 'chính sách'] },
  { id: 'terms', topic: 'terms', titleEn: 'Terms of Service', titleVi: 'Điều khoản dịch vụ', keywords: ['terms', 'điều khoản'] },
]

const SIDEBAR_NAV = [
  { key: 'home' as TopicKey, icon: <FaHome />, labelEn: 'Privacy Centre home', labelVi: 'Trang chủ Trung tâm riêng tư' },
]

const SIDEBAR_GROUPS = [
  {
    id: 'topics-group',
    icon: <FaShieldAlt />,
    labelEn: 'Privacy topics',
    labelVi: 'Chủ đề quyền riêng tư',
    items: [
      { key: 'sharing' as TopicKey, labelEn: 'Sharing', labelVi: 'Chia sẻ' },
      { key: 'safety' as TopicKey, labelEn: 'Safety', labelVi: 'An toàn' },
      { key: 'data' as TopicKey, labelEn: 'Data', labelVi: 'Dữ liệu' },
    ],
  },
  {
    id: 'resources-group',
    icon: <FaUsersCog />,
    labelEn: 'More privacy resources',
    labelVi: 'Tài nguyên riêng tư khác',
    items: [
      { key: 'cookies' as TopicKey, labelEn: 'Cookies', labelVi: 'Cookies' },
      { key: 'ad-choices' as TopicKey, labelEn: 'Ad Choices', labelVi: 'Lựa chọn quảng cáo' },
      { key: 'community-standards' as TopicKey, labelEn: 'Community Standards', labelVi: 'Tiêu chuẩn cộng đồng' },
    ],
  },
  {
    id: 'policy-group',
    icon: <FaLock />,
    labelEn: 'Privacy Policy',
    labelVi: 'Chính sách quyền riêng tư',
    items: [
      { key: 'policy-what' as TopicKey, labelEn: 'What is the Privacy Policy and what does it cover?', labelVi: 'Chính sách quyền riêng tư là gì và bao gồm những gì?' },
      { key: 'policy-info-collected' as TopicKey, labelEn: 'What information do we collect?', labelVi: 'Chúng tôi thu thập thông tin gì?' },
      { key: 'policy-how-use' as TopicKey, labelEn: 'How do we use your information?', labelVi: 'Chúng tôi sử dụng thông tin của bạn như thế nào?' },
      { key: 'policy-how-shared' as TopicKey, labelEn: 'How is your information shared on Group 36 Products or with integrated partners?', labelVi: 'Thông tin của bạn được chia sẻ trên Sản phẩm Group 36 hoặc với đối tác tích hợp như thế nào?' },
      { key: 'policy-third-party' as TopicKey, labelEn: 'How do we share information with third parties?', labelVi: 'Chúng tôi chia sẻ thông tin với bên thứ ba như thế nào?' },
      { key: 'policy-meta-companies' as TopicKey, labelEn: 'How do the Group 36 Companies work together?', labelVi: 'Các Công ty Group 36 làm việc cùng nhau như thế nào?' },
      { key: 'policy-manage-delete' as TopicKey, labelEn: 'How can you manage or delete your information and exercise your rights?', labelVi: 'Bạn có thể quản lý hoặc xóa thông tin và thực thi quyền của mình như thế nào?' },
      { key: 'policy-retention' as TopicKey, labelEn: 'How long do we keep your information for?', labelVi: 'Chúng tôi lưu giữ thông tin của bạn trong bao lâu?' },
      { key: 'policy-transfer' as TopicKey, labelEn: 'How do we transfer information?', labelVi: 'Chúng tôi chuyển thông tin như thế nào?' },
      { key: 'policy-legal' as TopicKey, labelEn: 'How do we respond to legal requests, comply with applicable law...', labelVi: 'Chúng tôi phản hồi yêu cầu pháp lý, tuân thủ pháp luật áp dụng...' },
    ],
  },
]

export function PrivacyPage({ onBack, initialTopic = 'home' }: PrivacyPageProps) {
  const { locale, setLocale } = useI18n()
  const [activeTopic, setActiveTopic] = useState<TopicKey>(initialTopic as TopicKey)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedAccordion, setExpandedAccordion] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'policy-group': true })
  const isVi = locale === 'vi'

  const t = (en: string, vi: string) => (isVi ? vi : en)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return SEARCH_ITEMS
    const q = searchQuery.toLowerCase()
    return SEARCH_ITEMS.filter(
      (item) =>
        item.titleEn.toLowerCase().includes(q) ||
        item.titleVi.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
    )
  }, [searchQuery])

  const toggleAccordion = (id: string) => {
    setExpandedAccordion((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const navigateTo = (topic: TopicKey) => {
    setActiveTopic(topic)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const renderSearchModal = () => {
    if (!searchOpen) return null
    return (
      <div className="privacy-search-overlay" onClick={() => setSearchOpen(false)}>
        <div className="privacy-search-modal" onClick={(e) => e.stopPropagation()}>
          <div className="privacy-search-header">
            <div className="privacy-search-input-wrap">
              <FaSearch className="privacy-search-icon" />
              <input
                autoFocus
                type="text"
                placeholder={t('Search Privacy Centre', 'Tìm kiếm Trung tâm quyền riêng tư')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="privacy-search-clear" onClick={() => setSearchQuery('')}>
                  <FaTimes size={12} />
                </button>
              )}
            </div>
            <button className="privacy-search-close" onClick={() => setSearchOpen(false)}>
              <FaTimes />
            </button>
          </div>
          <div className="privacy-search-results">
            {searchResults.length === 0 ? (
              <p className="privacy-search-empty">{t('No results found', 'Không tìm thấy kết quả')}</p>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  className="privacy-search-result-item"
                  onClick={() => navigateTo(item.topic)}
                >
                  <div className="result-text">
                    <span className="result-title">{isVi ? item.titleVi : item.titleEn}</span>
                  </div>
                  <FaChevronRight className="result-external" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderHome = () => (
    <>
      <h1>{t('Privacy Centre', 'Trung tâm quyền riêng tư')}</h1>
      <p className="privacy-subtitle">
        {t(
          'Make the privacy choices that are right for you. Learn how to manage and control your privacy on Fakebook, Messenger and other products.',
          'Lựa chọn quyền riêng tư phù hợp với bạn. Tìm hiểu cách quản lý và kiểm soát quyền riêng tư trên Fakebook, Messenger và các sản phẩm khác.'
        )}
      </p>

      <div className="privacy-section-header">
        <h2>{t('We build privacy into our products', 'Chúng tôi xây dựng quyền riêng tư vào sản phẩm')}</h2>
      </div>
      <div className="privacy-feature-scroll">
        <div className="privacy-feature-card" onClick={() => navigateTo('sharing')}>
          <div className="privacy-feature-card-icon blue"><FaComments /></div>
          <h3>{t('Private messaging', 'Nhắn tin riêng tư')}</h3>
          <p>{t('Our messaging products offer end-to-end encryption, so your conversations stay safe and secure.', 'Sản phẩm nhắn tin của chúng tôi cung cấp mã hóa đầu cuối, giúp cuộc trò chuyện của bạn an toàn và bảo mật.')}</p>
        </div>
        <div className="privacy-feature-card" onClick={() => navigateTo('safety')}>
          <div className="privacy-feature-card-icon green"><FaUserShield /></div>
          <h3>{t('Teen privacy', 'Quyền riêng tư vị thành niên')}</h3>
          <p>{t('Our default settings on Fakebook help create safe, age-appropriate experiences.', 'Cài đặt mặc định trên Fakebook giúp tạo trải nghiệm an toàn, phù hợp với độ tuổi.')}</p>
        </div>
      </div>

      <div className="privacy-section-header">
        <h2>{t('Privacy topics', 'Chủ đề quyền riêng tư')}</h2>
        <p>{t('Get answers to your privacy questions and manage your privacy in a way that is right for you.', 'Tìm câu trả lời cho câu hỏi về quyền riêng tư và quản lý quyền riêng tư theo cách phù hợp với bạn.')}</p>
      </div>
      <div className="privacy-topic-scroll">
        <div className="privacy-topic-card" onClick={() => navigateTo('data')}>
          <div className="privacy-topic-illustration" style={{ background: 'linear-gradient(135deg, #fff3e0, #ffe8cc)' }}>
            <FaDatabase size={64} color="#f57c00" />
          </div>
          <div className="privacy-topic-card-body">
            <h3>{t('Data Processing', 'Xử lý dữ liệu')}</h3>
            <p>{t('Group 36 processes data to improve our services and provide better experiences.', 'Group 36 xử lý dữ liệu để cải thiện dịch vụ và mang lại trải nghiệm tốt hơn.')}</p>
          </div>
        </div>
        <div className="privacy-topic-card" onClick={() => navigateTo('safety')}>
          <div className="privacy-topic-illustration" style={{ background: 'linear-gradient(135deg, #e3f7ed, #c8f0d8)' }}>
            <FaLock size={64} color="#00a651" />
          </div>
          <div className="privacy-topic-card-body">
            <h3>{t('Safety', 'An toàn')}</h3>
            <p>{t('Manage what you share to feel safer using our products.', 'Quản lý những gì bạn chia sẻ để cảm thấy an toàn hơn.')}</p>
          </div>
        </div>
      </div>
      <button className="privacy-view-all-btn" onClick={() => toggleGroup('topics-group')}>
        {t('View all topics', 'Xem tất cả chủ đề')}
      </button>

      <div className="privacy-section-header">
        <h2>{t('Learn about our commitment to privacy', 'Tìm hiểu cam kết về quyền riêng tư')}</h2>
        <p>{t('Find more resources that you can use to learn about how we build privacy into our products.', 'Tìm thêm tài nguyên để tìm hiểu cách chúng tôi xây dựng quyền riêng tư vào sản phẩm.')}</p>
      </div>
    </>
  )

  const renderSharing = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Sharing', 'Chia sẻ')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Learn about the tools that help you control who sees what you share.', 'Tìm hiểu công cụ giúp bạn kiểm soát ai thấy nội dung chia sẻ.')}</p>
      <div className="privacy-card">
        <h2>{t('Who can see your content', 'Ai có thể thấy nội dung')}</h2>
        <p>{t('You are in control of who can see what you share on Fakebook.', 'Bạn kiểm soát ai thấy những gì bạn chia sẻ trên Fakebook.')}</p>
        <ul className="privacy-checklist">
          <li><div className="privacy-check-icon"><FaUsers /></div><div className="privacy-check-content"><h4>{t('Public', 'Công khai')}</h4><p>{t('Anyone on or off Fakebook.', 'Bất kỳ ai trên hoặc ngoài Fakebook.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaUserShield /></div><div className="privacy-check-content"><h4>{t('Friends', 'Bạn bè')}</h4><p>{t('Only your friends on Fakebook.', 'Chỉ bạn bè trên Fakebook.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaUserLock /></div><div className="privacy-check-content"><h4>{t('Only me', 'Chỉ mình tôi')}</h4><p>{t('Only you can see this.', 'Chỉ bạn mới thấy.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaUserCircle /></div><div className="privacy-check-content"><h4>{t('Custom', 'Tùy chỉnh')}</h4><p>{t('Choose specific people or lists.', 'Chọn người cụ thể hoặc danh sách.')}</p></div></li>
        </ul>
      </div>
      <div className="privacy-card">
        <h2>{t('Profile and tagging', 'Hồ sơ và gắn thẻ')}</h2>
        <p>{t('Control who can post on your timeline and who sees posts you are tagged in.', 'Kiểm soát ai đăng trên dòng thời gian và ai thấy bài viết bạn được gắn thẻ.')}</p>
      </div>
      <div className="privacy-related-links">
        <h3>{t('Related topics', 'Chủ đề liên quan')}</h3>
        <button onClick={() => navigateTo('safety')}>{t('Learn about safety', 'Tìm hiểu về an toàn')} <FaChevronRight /></button>
        <button onClick={() => navigateTo('data')}>{t('Understand your data', 'Hiểu dữ liệu của bạn')} <FaChevronRight /></button>
      </div>
    </>
  )

  const renderSafety = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Safety', 'An toàn')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Learn about tools that help keep your account safe.', 'Tìm hiểu công cụ giúp tài khoản an toàn.')}</p>
      <div className="privacy-card">
        <h2>{t('Protecting your account', 'Bảo vệ tài khoản')}</h2>
        <ul className="privacy-checklist">
          <li><div className="privacy-check-icon"><FaLock /></div><div className="privacy-check-content"><h4>{t('Two-factor authentication (2FA)', 'Xác thực hai yếu tố (2FA)')}</h4><p>{t('Add an extra layer of security to your account.', 'Thêm lớp bảo mật extra cho tài khoản.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaMobileAlt /></div><div className="privacy-check-content"><h4>{t('Login alerts', 'Cảnh báo đăng nhập')}</h4><p>{t('Get notified of unrecognized logins to your account.', 'Nhận thông báo đăng nhập không xác định vào tài khoản.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaDesktop /></div><div className="privacy-check-content"><h4>{t('Authorized logins', 'Đăng nhập được ủy quyền')}</h4><p>{t('Manage devices where you are logged in.', 'Quản lý thiết bị đang đăng nhập.')}</p></div></li>
          <li><div className="privacy-check-icon"><FaEye /></div><div className="privacy-check-content"><h4>{t('Activity log', 'Nhật ký hoạt động')}</h4><p>{t('Review recent activity on your account.', 'Xem lại hoạt động gần đây trên tài khoản.')}</p></div></li>
        </ul>
      </div>
      <div className="privacy-related-links">
        <h3>{t('Related topics', 'Chủ đề liên quan')}</h3>
        <button onClick={() => navigateTo('sharing')}>{t('Learn about sharing', 'Tìm hiểu về chia sẻ')} <FaChevronRight /></button>
        <button onClick={() => navigateTo('account-deletion')}>{t('Delete your account', 'Xóa tài khoản')} <FaChevronRight /></button>
      </div>
    </>
  )

  const renderData = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Data', 'Dữ liệu')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Understand what information we collect and how it is used.', 'Hiểu thông tin chúng tôi thu thập và cách sử dụng.')}</p>
      <div className="privacy-card">
        <h2>{t('Information we collect', 'Thông tin chúng tôi thu thập')}</h2>
        <ul>
          <li>{t('Content you create (posts, photos, messages)', 'Nội dung bạn tạo (bài viết, ảnh, tin nhắn)')}</li>
          <li>{t('Information about your activity', 'Thông tin về hoạt động')}</li>
          <li>{t('Device attributes and identifiers', 'Thuộc tính và mã định danh thiết bị')}</li>
          <li>{t('Information from partners', 'Thông tin từ đối tác')}</li>
        </ul>
      </div>
      <div className="privacy-related-links">
        <h3>{t('Related topics', 'Chủ đề liên quan')}</h3>
        <button onClick={() => navigateTo('policy-info-collected')}>{t('Read our Privacy Policy', 'Đọc Chính sách quyền riêng tư')} <FaChevronRight /></button>
      </div>
    </>
  )

  const renderCookies = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Cookies', 'Cookies')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Learn about how we use cookies and similar technologies.', 'Tìm hiểu cách chúng tôi sử dụng cookie.')}</p>
      <div className="privacy-card">
        <h2>{t('What are cookies', 'Cookie là gì')}</h2>
        <p>{t('Cookies are small pieces of text stored on your browser when you visit most websites.', 'Cookie là các đoạn văn bản nhỏ được lưu trên trình duyệt khi bạn truy cập trang web.')}</p>
      </div>
      <div className="privacy-card">
        <h2>{t('How we use cookies', 'Cách chúng tôi sử dụng cookie')}</h2>
        <div className="privacy-accordion-item">
          <button className="privacy-accordion-header" onClick={() => toggleAccordion('auth')}>
            <span>{t('Authentication', 'Xác thực')}</span>
            <FaChevronDown className={`privacy-accordion-chevron ${expandedAccordion['auth'] ? 'expanded' : ''}`} />
          </button>
          {expandedAccordion['auth'] && <div className="privacy-accordion-body"><p>{t('We use cookies to verify your account and determine when you are logged in.', 'Chúng tôi sử dụng cookie để xác minh tài khoản và xác định khi nào bạn đăng nhập.')}</p></div>}
        </div>
        <div className="privacy-accordion-item">
          <button className="privacy-accordion-header" onClick={() => toggleAccordion('sec')}>
            <span>{t('Security', 'Bảo mật')}</span>
            <FaChevronDown className={`privacy-accordion-chevron ${expandedAccordion['sec'] ? 'expanded' : ''}`} />
          </button>
          {expandedAccordion['sec'] && <div className="privacy-accordion-body"><p>{t('We use cookies to support security activities.', 'Chúng tôi sử dụng cookie để hỗ trợ hoạt động bảo mật.')}</p></div>}
        </div>
        <div className="privacy-accordion-item">
          <button className="privacy-accordion-header" onClick={() => toggleAccordion('pref')}>
            <span>{t('Preferences', 'Tùy chọn')}</span>
            <FaChevronDown className={`privacy-accordion-chevron ${expandedAccordion['pref'] ? 'expanded' : ''}`} />
          </button>
          {expandedAccordion['pref'] && <div className="privacy-accordion-body"><p>{t('We use cookies to store your preferences such as language.', 'Chúng tôi sử dụng cookie để lưu tùy chọn như ngôn ngữ.')}</p></div>}
        </div>
        <div className="privacy-accordion-item">
          <button className="privacy-accordion-header" onClick={() => toggleAccordion('func')}>
            <span>{t('Functionality', 'Chức năng')}</span>
            <FaChevronDown className={`privacy-accordion-chevron ${expandedAccordion['func'] ? 'expanded' : ''}`} />
          </button>
          {expandedAccordion['func'] && <div className="privacy-accordion-body"><p>{t('We use cookies to provide functionality such as helping you fill out forms.', 'Chúng tôi sử dụng cookie để cung cấp chức năng như giúp bạn điền biểu mẫu.')}</p></div>}
        </div>
      </div>
      <div className="privacy-related-links">
        <h3>{t('Related topics', 'Chủ đề liên quan')}</h3>
        <button onClick={() => navigateTo('cookie-policy')}>{t('Read our Cookie Policy', 'Đọc Chính sách Cookie')} <FaChevronRight /></button>
      </div>
    </>
  )

  const renderPolicy = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Privacy Policy', 'Chính sách quyền riêng tư')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Last updated: August 3, 2026', 'Cập nhật lần cuối: 3 tháng 8, 2026')}</p>
      <div className="privacy-card">
        <h2>{t('Introduction', 'Giới thiệu')}</h2>
        <p>{t('This Privacy Policy describes how Fakebook collects, uses, and shares information about you when you use our Products.', 'Chính sách này mô tả cách Fakebook thu thập, sử dụng và chia sẻ thông tin về bạn khi bạn sử dụng Sản phẩm.')}</p>
      </div>
      <div className="privacy-card">
        <h2>{t('Information we collect', 'Thông tin chúng tôi thu thập')}</h2>
        <ul>
          <li><strong>{t('Information you provide', 'Thông tin bạn cung cấp')}</strong> — {t('Content and communications you provide.', 'Nội dung và truyền thông bạn cung cấp.')}</li>
          <li><strong>{t('Information from device', 'Thông tin từ thiết bị')}</strong> — {t('Device attributes and identifiers.', 'Thuộc tính và mã định danh thiết bị.')}</li>
          <li><strong>{t('Information from partners', 'Thông tin từ đối tác')}</strong> — {t('Information from third-party services.', 'Thông tin từ dịch vụ bên thứ ba.')}</li>
        </ul>
      </div>
      <div className="privacy-card">
        <h2>{t('How we use information', 'Cách chúng tôi sử dụng thông tin')}</h2>
        <p>{t('We use the information we have to provide and improve our Products, promote safety, and communicate with you.', 'Chúng tôi sử dụng thông tin để cung cấp và cải thiện Sản phẩm, thúc đẩy an toàn và giao tiếp với bạn.')}</p>
      </div>
      <div className="privacy-card">
        <h2>{t('Your rights', 'Quyền của bạn')}</h2>
        <p>{t('You have the right to access, correct, delete, and port your data.', 'Bạn có quyền truy cập, chỉnh sửa, xóa và mang theo dữ liệu.')}</p>
      </div>
      <div className="privacy-related-links">
        <h3>{t('Related policies', 'Chính sách liên quan')}</h3>
        <button onClick={() => navigateTo('data-policy')}>{t('Data Policy', 'Chính sách dữ liệu')} <FaChevronRight /></button>
        <button onClick={() => navigateTo('cookie-policy')}>{t('Cookie Policy', 'Chính sách Cookie')} <FaChevronRight /></button>
        <button onClick={() => navigateTo('terms')}>{t('Terms of Service', 'Điều khoản dịch vụ')} <FaChevronRight /></button>
      </div>
    </>
  )

  const renderPolicyWhat = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('What is the Privacy Policy and what does it cover?', 'Chính sách quyền riêng tư là gì và bao gồm những gì?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We collect and use information to provide and improve our Products, to provide a better experience and to keep our Products safe. This Privacy Policy applies to all of the Products offered by Fakebook and its affiliated companies.', 'Chúng tôi thu thập và sử dụng thông tin để cung cấp và cải thiện Sản phẩm, mang lại trải nghiệm tốt hơn và giữ an toàn cho Sản phẩm. Chính sách quyền riêng tư này áp dụng cho tất cả Sản phẩm do Fakebook và các công ty liên kết cung cấp.')}</p>
      </div>
    </>
  )

  const renderPolicyInfoCollected = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('What information do we collect?', 'Chúng tôi thu thập thông tin gì?')}</h1>
      </div>
      <div className="privacy-card">
        <h2>{t('Information you provide', 'Thông tin bạn cung cấp')}</h2>
        <ul>
          <li>{t('Account information (name, email, phone number)', 'Thông tin tài khoản (tên, email, số điện thoại)')}</li>
          <li>{t('Content you create (posts, photos, videos, messages)', 'Nội dung bạn tạo (bài viết, ảnh, video, tin nhắn)')}</li>
          <li>{t('Communications between you and others', 'Truyền thông giữa bạn và người khác')}</li>
        </ul>
      </div>
      <div className="privacy-card">
        <h2>{t('Device information', 'Thông tin thiết bị')}</h2>
        <ul>
          <li>{t('Device attributes (operating system, hardware version)', 'Thuộc tính thiết bị (hệ điều hành, phiên bản phần cứng)')}</li>
          <li>{t('Device operations (whether a window is foregrounded or backgrounded)', 'Thao tác thiết bị (cửa sổ có đang hiển thị hay không)')}</li>
          <li>{t('Identifiers (device IDs)', 'Mã định danh (ID thiết bị)')}</li>
          <li>{t('Device signals (Bluetooth signals, Wi-Fi access points)', 'Tín hiệu thiết bị (tín hiệu Bluetooth, điểm truy cập Wi-Fi)')}</li>
        </ul>
      </div>
      <div className="privacy-card">
        <h2>{t('Information from partners', 'Thông tin từ đối tác')}</h2>
        <p>{t('Partners who use our analytics services and advertisers may provide us with information about you.', 'Đối tác sử dụng dịch vụ phân tích và nhà quảng cáo có thể cung cấp cho chúng tôi thông tin về bạn.')}</p>
      </div>
    </>
  )

  const renderPolicyHowUse = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How do we use your information?', 'Chúng tôi sử dụng thông tin của bạn như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We use the information we have to provide and improve our Products, to promote safety, integrity and security, to communicate with you, and to research and innovate for social good.', 'Chúng tôi sử dụng thông tin để cung cấp và cải thiện Sản phẩm, thúc đẩy an toàn, toàn vẹn và bảo mật, giao tiếp với bạn, và nghiên cứu đổi mới vì lợi ích xã hội.')}</p>
      </div>
    </>
  )

  const renderPolicyHowShared = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How is your information shared on Group 36 Products or with integrated partners?', 'Thông tin của bạn được chia sẻ trên Sản phẩm Group 36 hoặc với đối tác tích hợp như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('When you use Fakebook, your information is shared with other people in accordance with your privacy settings. Information about your activity on Fakebook, such as your likes and profile views, may be visible when other users view your profile.', 'Khi bạn sử dụng Fakebook, thông tin của bạn được chia sẻ với người khác theo cài đặt quyền riêng tư. Thông tin về hoạt động trên Fakebook có thể được người khác xem khi họ xem hồ sơ của bạn.')}</p>
      </div>
    </>
  )

  const renderPolicyThirdParty = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How do we share information with third parties?', 'Chúng tôi chia sẻ thông tin với bên thứ ba như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We share information with third-party partners when we have your consent or when it is necessary to provide our services. We may also share information when required by law.', 'Chúng tôi chia sẻ thông tin với đối tác bên thứ ba khi có sự đồng ý của bạn hoặc khi cần thiết để cung cấp dịch vụ. Chúng tôi cũng có thể chia sẻ thông tin khi pháp luật yêu cầu.')}</p>
      </div>
    </>
  )

  const renderPolicyMetaCompanies = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How do the Group 36 Companies work together?', 'Các Công ty Group 36 làm việc cùng nhau như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('Group 36 companies share infrastructure, information, and technology to provide safe, consistent, and reliable services across our Products.', 'Các công ty Group 36 chia sẻ cơ sở hạ tầng, thông tin và công nghệ để cung cấp các dịch vụ an toàn, nhất quán và đáng tin cậy trên tất cả Sản phẩm.')}</p>
      </div>
    </>
  )

  const renderPolicyManageDelete = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How can you manage or delete your information and exercise your rights?', 'Bạn có thể quản lý hoặc xóa thông tin và thực thi quyền của mình như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <ul>
          <li>{t('Access and download your information', 'Truy cập và tải xuống thông tin của bạn')}</li>
          <li>{t('Correct inaccurate information', 'Chỉnh sửa thông tin không chính xác')}</li>
          <li>{t('Delete your account and information', 'Xóa tài khoản và thông tin')}</li>
          <li>{t('Object to processing of your information', 'Phản đối việc xử lý thông tin')}</li>
          <li>{t('Port your information to another service', 'Mang theo thông tin sang dịch vụ khác')}</li>
        </ul>
      </div>
    </>
  )

  const renderPolicyRetention = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How long do we keep your information for?', 'Chúng tôi lưu giữ thông tin của bạn trong bao lâu?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We keep your information for as long as necessary to provide our services or until your account is deleted. The retention period depends on the type of information and the purpose for which it is processed.', 'Chúng tôi lưu giữ thông tin của bạn miễn là cần thiết để cung cấp dịch vụ hoặc cho đến khi tài khoản bị xóa. Thời gian lưu giữ phụ thuộc vào loại thông tin và mục đích xử lý.')}</p>
      </div>
    </>
  )

  const renderPolicyTransfer = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How do we transfer information?', 'Chúng tôi chuyển thông tin như thế nào?')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We may transfer, store, and process your information in countries other than your own. We ensure appropriate safeguards are in place for such transfers.', 'Chúng tôi có thể chuyển, lưu trữ và xử lý thông tin ở các quốc gia khác ngoài quốc gia của bạn. Chúng tôi đảm bảo có biện pháp bảo vệ phù hợp cho việc chuyển giao đó.')}</p>
      </div>
    </>
  )

  const renderPolicyLegal = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How do we respond to legal requests, comply with applicable law...', 'Chúng tôi phản hồi yêu cầu pháp lý, tuân thủ pháp luật áp dụng...')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('We may access, preserve, and disclose information when we have a good faith belief that it is necessary to detect, prevent, and address fraud, unauthorized use, and violations of our terms and policies.', 'Chúng tôi có thể truy cập, bảo tồn và tiết lộ thông tin khi có niềm tin thiện chí rằng điều đó cần thiết để phát hiện, ngăn chặn và giải quyết gian lận, sử dụng trái phép và vi phạm điều khoản và chính sách.')}</p>
      </div>
    </>
  )

  const renderAdChoices = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Ad Choices', 'Lựa chọn quảng cáo')}</h1>
      </div>
      <div className="privacy-card">
        <h2>{t('How ads work', 'Quảng cáo hoạt động thế nào')}</h2>
        <p>{t('We show you ads to help support our services. We use information about your interests and activity to show you relevant ads.', 'Chúng tôi hiển thị quảng cáo để hỗ trợ dịch vụ. Chúng tôi sử dụng thông tin về sở thích và hoạt động để hiển thị quảng cáo liên quan.')}</p>
      </div>
      <div className="privacy-card">
        <h2>{t('Your ad choices', 'Lựa chọn quảng cáo của bạn')}</h2>
        <ul>
          <li>{t('Control whether we use your information for ads', 'Kiểm soát xem chúng tôi có sử dụng thông tin cho quảng cáo không')}</li>
          <li>{t('Hide ads from specific advertisers', 'Ẩn quảng cáo từ nhà quảng cáo cụ thể')}</li>
          <li>{t('See why you are shown a specific ad', 'Xem lý do tại sao bạn được hiển thị một quảng cáo cụ thể')}</li>
        </ul>
      </div>
    </>
  )

  const renderCommunityStandards = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Community Standards', 'Tiêu chuẩn cộng đồng')}</h1>
      </div>
      <div className="privacy-card">
        <h2>{t('Our values', 'Giá trị của chúng tôi')}</h2>
        <p>{t('Our Community Standards are informed by our values: giving people a voice, promoting safety, and ensuring consistency.', 'Tiêu chuẩn Cộng đồng được dựa trên giá trị của chúng tôi: cho mọi người tiếng nói, thúc đẩy an toàn và đảm bảo tính nhất quán.')}</p>
      </div>
      <div className="privacy-card">
        <h2>{t('What is not allowed', 'Những gì không được phép')}</h2>
        <ul>
          <li>{t('Violence and incitement', 'Bạo lực và kích động')}</li>
          <li>{t('Hate speech', 'Phát biểu thù địch')}</li>
          <li>{t('Harassment and bullying', 'Quấy rối và bắt nạt')}</li>
          <li>{t('Spam and fake accounts', 'Thư rác và tài khoản giả mạo')}</li>
        </ul>
      </div>
    </>
  )

  const renderTerms = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Terms of Service', 'Điều khoản dịch vụ')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Last updated: August 3, 2026', 'Cập nhật lần cuối: 3 tháng 8, 2026')}</p>
      <div className="privacy-card">
        <h2>{t('Acceptance of terms', 'Chấp nhận điều khoản')}</h2>
        <p>{t('By using our services, you agree to these terms. Please read them carefully.', 'Bằng cách sử dụng dịch vụ, bạn đồng ý với các điều khoản này. Vui lòng đọc kỹ.')}</p>
      </div>
    </>
  )

  const renderDataPolicy = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Data Policy', 'Chính sách dữ liệu')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Last updated: August 3, 2026', 'Cập nhật lần cuối: 3 tháng 8, 2026')}</p>
      <div className="privacy-card">
        <h2>{t('What data we collect', 'Dữ liệu chúng tôi thu thập')}</h2>
        <p>{t('We collect information about you, your device, and how you use our services.', 'Chúng tôi thu thập thông tin về bạn, thiết bị và cách bạn sử dụng dịch vụ.')}</p>
      </div>
    </>
  )

  const renderCookiePolicy = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Cookie Policy', 'Chính sách Cookie')}</h1>
      </div>
      <p className="privacy-subtitle">{t('Last updated: August 3, 2026', 'Cập nhật lần cuối: 3 tháng 8, 2026')}</p>
      <div className="privacy-card">
        <h2>{t('What are cookies', 'Cookie là gì')}</h2>
        <p>{t('Cookies are small text files stored on your browser or device by websites, apps, and online media.', 'Cookie là các tệp văn bản nhỏ được lưu trên trình duyệt hoặc thiết bị bởi các trang web, ứng dụng và phương tiện trực tuyến.')}</p>
      </div>
    </>
  )

  const renderRequestRemoval = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('Request Removal of Your Information', 'Yêu cầu gỡ bỏ thông tin')}</h1>
      </div>
      <div className="privacy-card">
        <p>{t('You can request removal of your information by contacting us or using our dedicated form.', 'Bạn có thể yêu cầu gỡ bỏ thông tin bằng cách liên hệ chúng tôi hoặc sử dụng biểu mẫu chuyên dụng.')}</p>
      </div>
    </>
  )

  const renderAccountDeletion = () => (
    <>
      <div className="privacy-detail-header">
        <button className="privacy-back-btn" onClick={() => navigateTo('home')}><FaArrowLeft /></button>
        <h1>{t('How to delete your account', 'Cách xóa tài khoản')}</h1>
      </div>
      <div className="privacy-card">
        <h2>{t('Before you delete', 'Trước khi xóa')}</h2>
        <ul>
          <li>{t('Download your information', 'Tải xuống thông tin của bạn')}</li>
          <li>{t('Transfer your information to another service', 'Chuyển thông tin sang dịch vụ khác')}</li>
        </ul>
      </div>
      <div className="privacy-card">
        <h2>{t('How to delete', 'Cách xóa')}</h2>
        <p>{t('Go to Settings > Account > Delete Account. Once deleted, your account cannot be recovered.', 'Đi tới Cài đặt > Tài khoản > Xóa tài khoản. Sau khi xóa, tài khoản không thể khôi phục.')}</p>
      </div>
    </>
  )

  const renderContent = () => {
    switch (activeTopic) {
      case 'home': return renderHome()
      case 'sharing': return renderSharing()
      case 'safety': return renderSafety()
      case 'data': return renderData()
      case 'cookies': return renderCookies()
      case 'policy': return renderPolicy()
      case 'policy-what': return renderPolicyWhat()
      case 'policy-info-collected': return renderPolicyInfoCollected()
      case 'policy-how-use': return renderPolicyHowUse()
      case 'policy-how-shared': return renderPolicyHowShared()
      case 'policy-third-party': return renderPolicyThirdParty()
      case 'policy-meta-companies': return renderPolicyMetaCompanies()
      case 'policy-manage-delete': return renderPolicyManageDelete()
      case 'policy-retention': return renderPolicyRetention()
      case 'policy-transfer': return renderPolicyTransfer()
      case 'policy-legal': return renderPolicyLegal()
      case 'ad-choices': return renderAdChoices()
      case 'community-standards': return renderCommunityStandards()
      case 'terms': return renderTerms()
      case 'data-policy': return renderDataPolicy()
      case 'cookie-policy': return renderCookiePolicy()
      case 'request-removal': return renderRequestRemoval()
      case 'account-deletion': return renderAccountDeletion()
      default: return renderHome()
    }
  }

  return (
    <div className="privacy-page-wrapper">
      <header className="privacy-header">
        <button type="button" className="privacy-header-logo" onClick={onBack}>
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
          <span>Group 36</span>
        </button>
        <div className="privacy-header-actions">
          <select className="privacy-lang-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="en">English (UK)</option>
            <option value="vi">Tiếng Việt</option>
          </select>
          <button className="privacy-close-btn" onClick={onBack} aria-label={t('Close', 'Đóng')}>
            <FaTimes size={20} />
          </button>
        </div>
      </header>
      <div className="privacy-main-container">
        <aside className="privacy-sidebar">
          <div className="privacy-sidebar-title">Privacy Centre</div>
          <nav>
            {SIDEBAR_NAV.map((item) => (
              <button
                key={item.key}
                className={`privacy-nav-item ${activeTopic === item.key ? 'active' : ''}`}
                onClick={() => navigateTo(item.key)}
              >
                <span className="privacy-nav-icon">{item.icon}</span>
                {isVi ? item.labelVi : item.labelEn}
              </button>
            ))}
            <button className="privacy-nav-item" onClick={() => setSearchOpen(true)}>
              <span className="privacy-nav-icon"><FaSearch /></span>
              {t('Search', 'Tìm kiếm')}
            </button>
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.id} className="privacy-nav-group">
                <button
                  className="privacy-nav-group-header"
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="nav-icon">{group.icon}</span>
                  {isVi ? group.labelVi : group.labelEn}
                  <FaChevronDown className={`nav-chevron ${expandedGroups[group.id] ? 'expanded' : ''}`} />
                </button>
                {expandedGroups[group.id] && (
                  <ul className="privacy-nav-group-items">
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <button
                          className={`privacy-nav-item ${activeTopic === item.key ? 'active' : ''}`}
                          onClick={() => navigateTo(item.key)}
                        >
                          {isVi ? item.labelVi : item.labelEn}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </aside>
        <main className="privacy-content-area">
          {renderContent()}
        </main>
      </div>
      {renderSearchModal()}
    </div>
  )
}
