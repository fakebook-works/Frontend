import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { useI18n } from '../i18n';
import { HELP_CATEGORIES } from './data/helpData';
import { 
  FaSearch, 
  FaChevronDown, 
  FaArrowLeft,
  FaKey,
  FaUserCircle,
  FaShieldAlt,
  FaStore,
  FaUsers,
  FaFileAlt,
  FaChevronRight
} from 'react-icons/fa';
import './HelpPage.css';

interface HelpArticle {
  id: string;
  titleVi: string;
  titleEn: string;
  contentVi: React.ReactNode;
  contentEn: React.ReactNode;
  categoryTitle?: string;
}

interface HelpCategory {
  id: string;
  icon: React.ReactNode;
  titleVi: string;
  titleEn: string;
  articles: HelpArticle[];
}

const logo = '/brand/fakebook-minimal-cropped.png';

const HelpPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(null);
  const { t, locale } = useI18n();

  // Popular topics for the landing grid
  const popularTopics = [
    { title: t('helpAccountSettings'), desc: t('helpAccountSettingsDesc'), icon: <FaUserCircle /> },
    { title: t('helpLoginPassword'), desc: t('helpLoginPasswordDesc'), icon: <FaKey /> },
    { title: t('helpPrivacySecurity'), desc: t('helpPrivacySecurityDesc'), icon: <FaShieldAlt /> },
    { title: t('helpMarketplace'), desc: t('helpMarketplaceDesc'), icon: <FaStore /> },
    { title: t('helpGroups'), desc: t('helpGroupsDesc'), icon: <FaUsers /> },
    { title: t('helpPages'), desc: t('helpPagesDesc'), icon: <FaFileAlt /> }
  ];

  const handleCategoryClick = (cat: HelpCategory) => {
    setActiveCategory(activeCategory === cat.id ? null : cat.id);
  };

  const handleArticleClick = (art: HelpArticle, cat: HelpCategory) => {
    setActiveArticle({ ...art, categoryTitle: locale === 'vi' ? cat.titleVi : cat.titleEn });
  };

  const goHome = () => {
    setActiveCategory(null);
    setActiveArticle(null);
  };

  return (
    <div className="help-page-wrapper">
      {/* Header */}
      <header className="help-header">
        <div className="help-header-left">
          <img src={logo} alt="Fakebook Logo" className="help-logo-icon" onClick={() => { if (onBack) onBack(); else navigate('/'); }} style={{cursor: 'pointer'}} />
          <span className="help-logo-text" onClick={(e) => { e.stopPropagation(); if (onBack) onBack(); else navigate('/'); }} style={{cursor: 'pointer'}}>{t('helpTitle')}</span>
        </div>
        
        {/* Only show search in header if in article view */}
        {activeArticle && (
          <div className="help-header-search">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder={t('helpSearchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="help-header-right">
        </div>
      </header>

      <div className="help-main-layout">
        {/* Sidebar */}
        <aside className="help-sidebar">
          <nav className="help-sidebar-nav">
            {HELP_CATEGORIES.map((cat: HelpCategory) => (
              <div key={cat.id} className="help-nav-group">
                <button 
                  className={`help-nav-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat)}
                >
                  <div className="cat-btn-left">
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-title">{locale === 'vi' ? cat.titleVi : cat.titleEn}</span>
                  </div>
                  <FaChevronDown className={`cat-chevron ${activeCategory === cat.id ? 'open' : ''}`} />
                </button>
                
                {activeCategory === cat.id && (
                  <div className="help-nav-articles">
                    {cat.articles.map((art: HelpArticle) => (
                      <button 
                        key={art.id} 
                        className={`help-nav-art-btn ${activeArticle?.id === art.id ? 'active' : ''}`}
                        onClick={() => handleArticleClick(art, cat)}
                      >
                        {locale === 'vi' ? art.titleVi : art.titleEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="help-content-area">
          {!activeArticle ? (
            <div className="help-landing">
              <div className="help-landing-hero">
                <FaFileAlt className="help-hero-icon" style={{color: '#1877f2'}} />
                <h1>{t('helpHeroTitle')}</h1>
                <div className="help-hero-search">
                  <input 
                    type="text" 
                    placeholder={t('helpSearchPlaceholder')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="search-submit-btn">
                    <FaArrowLeft style={{transform: 'rotate(90deg)'}} />
                  </button>
                </div>
                <p className="help-hero-terms">
                  {t('helpTermsNote')}
                </p>
              </div>

              <div className="help-popular-topics">
                <h2>{t('helpPopularTopics')}</h2>
                
                <div className="help-banner-blue">
                  <div className="banner-icon-bg">
                    <FaKey className="banner-icon" />
                  </div>
                  <div className="banner-text">
                    <h3>{t('helpLoginBannerTitle')}</h3>
                    <p>{t('helpLoginBannerDesc')}</p>
                  </div>
                  <button className="banner-btn">{t('helpGetHelp')}</button>
                </div>

                <div className="help-topics-grid">
                  {popularTopics.map((topic, idx) => (
                    <div key={idx} className="help-topic-card">
                      <div className="topic-icon-placeholder">
                        {topic.icon}
                      </div>
                      <h3>{topic.title}</h3>
                      <p>{topic.desc}</p>
                    </div>
                  ))}
                </div>
                
                <div className="help-other-ways">
                  <h2>{t('helpOtherWays')}</h2>
                  <div className="help-action-card">
                    <div className="action-left">
                      <FaSearch className="action-icon" />
                      <div>
                        <h3>{t('helpSearchCentre')}</h3>
                        <p>{t('helpSearchCentreDesc')}</p>
                      </div>
                    </div>
                    <FaChevronRight className="action-arrow" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="help-article-view">
              <div className="breadcrumb">
                <span onClick={goHome}>{activeArticle.categoryTitle}</span>
                <FaChevronRight className="bc-sep" />
                <span className="current">{locale === 'vi' ? activeArticle.titleVi : activeArticle.titleEn}</span>
              </div>
              
              <h1 className="article-main-title">{locale === 'vi' ? activeArticle.titleVi : activeArticle.titleEn}</h1>
              
              <div className="article-pill-buttons">
                <button className="pill-btn"><FaFileAlt style={{marginRight: 8, color: '#1877f2'}}/> {locale === 'vi' ? activeArticle.titleVi : activeArticle.titleEn}</button>
                <button className="pill-btn">{t('helpDifferentQuestion')}</button>
              </div>

              <div className="article-content-body">
                {locale === 'vi' ? activeArticle.contentVi : activeArticle.contentEn}
              </div>
              
              <div className="article-feedback">
                <div className="feedback-box">
                  <h3>{t('helpWasHelpful')}</h3>
                  <div className="feedback-btns">
                    <button>{t('helpYes')}</button>
                    <button>{t('helpNo')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export { HelpPage };
