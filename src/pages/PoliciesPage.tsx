import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Locale } from '../i18n'
import './PoliciesPage.css'

export interface PoliciesPageProps {
  onBack?: () => void
  initialTopic?: string
}

export function PoliciesPage({ onBack, initialTopic = 'terms' }: PoliciesPageProps) {
  const { locale, setLocale } = useI18n()
  const [activeTopic, setActiveTopic] = useState(initialTopic)
  const isVi = locale === 'vi'

  const renderContent = () => {
    switch (activeTopic) {
      case 'terms':
        return (
          <>
            <h1>{isVi ? 'Điều khoản dịch vụ' : 'Terms of Service'}</h1>
            <p>
              {isVi
                ? 'Chào mừng bạn đến với Fakebook!'
                : 'Welcome to Fakebook!'}
            </p>
            <p>
              {isVi
                ? 'Các Điều khoản này chi phối việc bạn sử dụng Fakebook, Messenger và các sản phẩm, tính năng, ứng dụng, dịch vụ, công nghệ cũng như phần mềm khác mà chúng tôi cung cấp. Những sản phẩm này hợp thành Sản phẩm của Group 36.'
                : 'These Terms govern your use of Fakebook, Messenger, and the other products, features, apps, services, technologies, and software we offer. These products make up the Group 36 Products.'}
            </p>
            <h2>{isVi ? '1. Các dịch vụ chúng tôi cung cấp' : '1. The services we provide'}</h2>
            <p>
              {isVi
                ? 'Sứ mệnh của chúng tôi là mang mọi người đến gần nhau hơn và xây dựng cộng đồng. Để xúc tiến sứ mệnh này, chúng tôi cung cấp các Sản phẩm và dịch vụ được mô tả dưới đây cho bạn:'
                : 'Our mission is to give people the power to build community and bring the world closer together. To help advance this mission, we provide the Products and services described below to you:'}
            </p>
            <ul>
              <li>{isVi ? 'Cung cấp trải nghiệm cá nhân hóa cho bạn.' : 'Provide a personalized experience for you.'}</li>
              <li>{isVi ? 'Kết nối bạn với những người và tổ chức mà bạn quan tâm.' : 'Connect you with people and organizations you care about.'}</li>
              <li>{isVi ? 'Hỗ trợ bạn khám phá nội dung, sản phẩm và dịch vụ mà bạn có thể quan tâm.' : 'Help you discover content, products, and services that may interest you.'}</li>
            </ul>
            <h2>{isVi ? '2. Cam kết của bạn với chúng tôi' : '2. Your commitments to us'}</h2>
            <p>
              {isVi
                ? 'Chúng tôi cung cấp các dịch vụ này cho bạn và những người khác để giúp thúc đẩy sứ mệnh của mình. Đổi lại, chúng tôi cần bạn thực hiện các cam kết sau:'
                : 'We provide these services to you and others to help advance our mission. In exchange, we need you to make the following commitments:'}
            </p>
            <ul>
              <li>{isVi ? 'Sử dụng cùng tên mà bạn sử dụng trong đời thực.' : 'Use the same name that you use in everyday life.'}</li>
              <li>{isVi ? 'Cung cấp thông tin chính xác về bản thân.' : 'Provide accurate information about yourself.'}</li>
              <li>{isVi ? 'Tạo một tài khoản (của chính bạn) và sử dụng dòng thời gian của mình cho mục đích cá nhân.' : 'Create only one account (your own) and use your timeline for personal purposes.'}</li>
            </ul>
          </>
        )
      case 'community':
        return (
          <>
            <h1>{isVi ? 'Tiêu chuẩn cộng đồng' : 'Community Standards'}</h1>
            <p>
              {isVi
                ? 'Mục tiêu của Tiêu chuẩn cộng đồng của chúng tôi là tạo ra một nơi để mọi người tự do thể hiện bản thân và nói lên tiếng nói của mình.'
                : 'The goal of our Community Standards is to create a place for expression and give people a voice.'}
            </p>
            <h2>{isVi ? 'Bạo lực và hành vi phạm tội' : 'Violence and Criminal Behavior'}</h2>
            <p>
              {isVi
                ? 'Nhằm ngăn chặn và gián đoạn hoạt động gây hại ngoài đời thực, chúng tôi không cho phép các tổ chức hoặc cá nhân tuyên bố sứ mệnh bạo lực hay tham gia vào hành vi bạo lực có mặt trên Fakebook.'
                : 'To prevent and disrupt real-world harm, we do not allow organizations or individuals that proclaim a violent mission or are engaged in violence to have a presence on Fakebook.'}
            </p>
            <h2>{isVi ? 'Sự an toàn' : 'Safety'}</h2>
            <p>
              {isVi
                ? 'Chúng tôi xóa nội dung khuyến khích tự tử hoặc tự gây thương tích, bao gồm mô tả chân thực về hành vi này.'
                : 'We remove content that encourages suicide or self-injury, including graphic imagery.'}
            </p>
          </>
        )
      case 'privacy':
        return (
          <>
            <h1>{isVi ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}</h1>
            <p>
              {isVi
                ? 'Vui lòng truy cập Trung tâm Quyền riêng tư của chúng tôi để biết chi tiết về việc thu thập, sử dụng và chia sẻ dữ liệu.'
                : 'Please visit our Privacy Center for details on data collection, use, and sharing.'}
            </p>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="policies-page-wrapper">
      <header className="policies-header">
        <button type="button" className="policies-header-logo" onClick={onBack}>
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
          <span>Group 36</span>
        </button>
        <div className="policies-header-actions">
          <select
            className="policies-lang-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="en">English (UK)</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
      </header>
      <div className="policies-main-container">
        <aside className="policies-sidebar">
          <button
            className={`policies-nav-item ${activeTopic === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveTopic('terms')}
          >
            {isVi ? 'Điều khoản dịch vụ' : 'Terms of Service'}
          </button>
          <button
            className={`policies-nav-item ${activeTopic === 'community' ? 'active' : ''}`}
            onClick={() => setActiveTopic('community')}
          >
            {isVi ? 'Tiêu chuẩn cộng đồng' : 'Community Standards'}
          </button>
          <button
            className={`policies-nav-item ${activeTopic === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTopic('privacy')}
          >
            {isVi ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}
          </button>
        </aside>
        <main className="policies-content-area">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
