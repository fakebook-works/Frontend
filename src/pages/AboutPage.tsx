import { useI18n } from '../i18n'
import type { Locale } from '../i18n'
import {
  FaUsers,
  FaHandshake,
  FaRocket,
  FaShieldAlt,
  FaArrowRight,
  FaBalanceScale,
  FaEye,
  FaLock,
} from 'react-icons/fa'
import './AboutPage.css'

export interface AboutPageProps {
  onBack?: () => void
  initialSection?: string
}

export function AboutPage({ onBack }: AboutPageProps) {
  const { locale, setLocale } = useI18n()
  const isVi = locale === 'vi'

  const t = (en: string, vi: string) => (isVi ? vi : en)

  return (
    <div className="about-page-wrapper">
      <header className="about-header-meta">
        <button type="button" className="about-header-logo" onClick={onBack}>
          <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
          <span>Group 36</span>
        </button>

        <nav className="about-header-nav">
          <button type="button">{t('Who we are', 'Ai là chúng tôi')}</button>
          <button type="button">{t('What we build', 'Những gì chúng tôi xây dựng')}</button>
          <button type="button">{t('Responsibility', 'Trách nhiệm')}</button>
          <select
            className="about-lang-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label="Language selector"
          >
            <option value="en">English (UK)</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </nav>
      </header>

      {/* Hero */}
      <section className="about-hero">
        <h1>
          {t(
            'Fakebook builds technologies that help people connect, find communities, and grow businesses.',
            'Fakebook xây dựng công nghệ giúp mọi người kết nối, tìm cộng đồng và phát triển doanh nghiệp.'
          )}
        </h1>
        <p>
          {t(
            'We are moving beyond 2D screens toward immersive experiences like augmented and virtual reality that can help build the next evolution of social technology.',
            'Chúng tôi đang vượt qua các màn hình 2D hướng đến trải nghiệm sống động như thực tế ảo và tăng cường để giúp xây dựng sự phát triển tiếp theo của công nghệ xã hội.'
          )}
        </p>
      </section>

      {/* Values */}
      <section className="about-section">
        <div className="about-container-inner">
          <h2>{t('Our values', 'Giá trị của chúng tôi')}</h2>
          <p>
            {t(
              'These core values guide how we build our products and how we work together.',
              'Các giá trị cốt lõi này hướng dẫn cách chúng tôi xây dựng sản phẩm và cách làm việc cùng nhau.'
            )}
          </p>
          <div className="about-values-grid">
            <div className="about-value-card">
              <div className="about-value-icon"><FaUsers /></div>
              <h3>{t('Give people a voice', 'Trao quyền cho mọi người')}</h3>
              <p>
                {t(
                  'We give people a voice by building new ways for people to express themselves across the Fakebook family of apps.',
                  'Chúng tôi trao quyền cho mọi người bằng cách xây dựng các cách mới để mọi người thể hiện bản thân trên toàn bộ các ứng dụng Fakebook.'
                )}
              </p>
            </div>
            <div className="about-value-card">
              <div className="about-value-icon"><FaHandshake /></div>
              <h3>{t('Build community', 'Xây dựng cộng đồng')}</h3>
              <p>
                {t(
                  'We help people connect with friends, family, and communities by building tools that help create a sense of community.',
                  'Chúng tôi giúp mọi người kết nối với bạn bè, gia đình và cộng đồng bằng cách xây dựng công cụ giúp tạo cảm giác cộng đồng.'
                )}
              </p>
            </div>
            <div className="about-value-card">
              <div className="about-value-icon"><FaRocket /></div>
              <h3>{t('Encourage innovation', 'Khuyến khích đổi mới')}</h3>
              <p>
                {t(
                  'We encourage innovation by constantly pushing the boundaries of what is possible with technology.',
                  'Chúng tôi khuyến khích đổi mới bằng cách liên tục đẩy ranh giới của những gì có thể với công nghệ.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="about-stats-section">
        <div className="about-stats-grid">
          <div className="about-stat-item">
            <h3>3B+</h3>
            <p>{t('Monthly active users', 'Người dùng hoạt động hàng tháng')}</p>
          </div>
          <div className="about-stat-item">
            <h3>200+</h3>
            <p>{t('Countries and regions', 'Quốc gia và khu vực')}</p>
          </div>
          <div className="about-stat-item">
            <h3>50K+</h3>
            <p>{t('Employees', 'Nhân viên')}</p>
          </div>
          <div className="about-stat-item">
            <h3>20+</h3>
            <p>{t('Products and services', 'Sản phẩm và dịch vụ')}</p>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="about-section about-section-alt">
        <div className="about-container-inner">
          <h2>{t('What we build', 'Những gì chúng tôi xây dựng')}</h2>
          <p>
            {t(
              'Our products help people connect and share, build communities, and grow businesses.',
              'Sản phẩm của chúng tôi giúp mọi người kết nối và chia sẻ, xây dựng cộng đồng và phát triển doanh nghiệp.'
            )}
          </p>
          <div className="about-products-grid">
            <div className="about-product-card">
              <div className="about-product-visual fb">F</div>
              <div className="about-product-body">
                <h3>Fakebook</h3>
                <p>
                  {t(
                    'A place to bring people together. Discover new interests, groups, and friends every day.',
                    'Nơi mang mọi người đến với nhau. Khám phá sở thích, nhóm và bạn bè mới mỗi ngày.'
                  )}
                </p>
                <button type="button" className="about-product-link">
                  {t('Learn more', 'Tìm hiểu thêm')} <FaArrowRight />
                </button>
              </div>
            </div>
            <div className="about-product-card">
              <div className="about-product-visual msgr">M</div>
              <div className="about-product-body">
                <h3>Messenger</h3>
                <p>
                  {t(
                    'Bringing people together, one message at a time. Share texts, photos, and video calls for free.',
                    'Gắn kết mọi người, một tin nhắn mỗi lần. Chia sẻ tin nhắn, ảnh và gọi video miễn phí.'
                  )}
                </p>
                <button type="button" className="about-product-link">
                  {t('Learn more', 'Tìm hiểu thêm')} <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Responsibility */}
      <section className="about-section">
        <div className="about-container-inner">
          <h2>{t('Our responsibility', 'Trách nhiệm của chúng tôi')}</h2>
          <p>
            {t(
              'We are committed to building a safe and inclusive platform for everyone.',
              'Chúng tôi cam kết xây dựng một nền tảng an toàn và hòa nhập cho tất cả mọi người.'
            )}
          </p>
          <div className="about-responsibility-grid">
            <div className="about-responsibility-card">
              <div className="about-responsibility-icon"><FaShieldAlt /></div>
              <div>
                <h4>{t('Safety', 'An toàn')}</h4>
                <p>{t('Building technology that keeps people safe on our platforms.', 'Xây dựng công nghệ giữ mọi người an toàn trên nền tảng.')}</p>
              </div>
            </div>
            <div className="about-responsibility-card">
              <div className="about-responsibility-icon"><FaEye /></div>
              <div>
                <h4>{t('Privacy', 'Quyền riêng tư')}</h4>
                <p>{t('Building products that protect people\'s privacy and give them control.', 'Xây dựng sản phẩm bảo vệ quyền riêng tư và trao quyền kiểm soát.')}</p>
              </div>
            </div>
            <div className="about-responsibility-card">
              <div className="about-responsibility-icon"><FaBalanceScale /></div>
              <div>
                <h4>{t('Equity and inclusion', 'Công bằng và hòa nhập')}</h4>
                <p>{t('Promoting equity and inclusion in everything we do.', 'Thúc đẩy công bằng và hòa nhập trong mọi việc chúng tôi làm.')}</p>
              </div>
            </div>
            <div className="about-responsibility-card">
              <div className="about-responsibility-icon"><FaLock /></div>
              <div>
                <h4>{t('Data security', 'Bảo mật dữ liệu')}</h4>
                <p>{t('Protecting the data of billions of people who use our products.', 'Bảo vệ dữ liệu của hàng tỷ người sử dụng sản phẩm.')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-inner">
          <div className="about-footer-logo">
            <img src="/brand/fakebook-minimal-cropped.png" alt="Fakebook" />
            <span>Group 36</span>
          </div>
          <div className="about-footer-links">
            <a href="#">{t('Privacy Policy', 'Chính sách quyền riêng tư')}</a>
            <a href="#">{t('Terms of Service', 'Điều khoản dịch vụ')}</a>
            <a href="#">{t('Community Standards', 'Tiêu chuẩn cộng đồng')}</a>
            <a href="#">{t('Cookie Policy', 'Chính sách Cookie')}</a>
            <a href="#">{t('Help Centre', 'Trung tâm hỗ trợ')}</a>
          </div>
          <p>&copy; {new Date().getFullYear()} Fakebook, Inc.</p>
        </div>
      </footer>
    </div>
  )
}
