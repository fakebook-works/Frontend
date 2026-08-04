import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { HELP_CATEGORIES } from './data/helpData';
import { 
  FaSearch, 
  FaChevronDown, 
  FaGlobe, 
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

const logo = '/brand/fakebook-minimal-cropped.png';

const HelpPage: React.FC<{ onBack?: () => void; initialTopic?: string }> = ({ onBack, initialTopic }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<any | null>(null);
  const [isVi, setIsVi] = useState(true);

  // Popular topics for the landing grid
  const popularTopics = [
    { title: 'Account settings', desc: 'Adjust settings, manage notifications, learn about name changes and more.', icon: <FaUserCircle /> },
    { title: 'Login and password', desc: 'Fix login issues and learn how to change or reset your password.', icon: <FaKey /> },
    { title: 'Privacy and security', desc: 'Control who can see what you share and add extra protection to your account.', icon: <FaShieldAlt /> },
    { title: 'Marketplace', desc: 'Learn how to buy and sell things on Facebook.', icon: <FaStore /> },
    { title: 'Groups', desc: 'Learn how to create, manage and use Groups.', icon: <FaUsers /> },
    { title: 'Pages', desc: 'Learn how to create, use, follow and manage a Page.', icon: <FaFileAlt /> }
  ];

  const handleCategoryClick = (cat: any) => {
    setActiveCategory(activeCategory === cat.id ? null : cat.id);
  };

  const handleArticleClick = (art: any, cat: any) => {
    setActiveArticle({ ...art, categoryTitle: isVi ? cat.titleVi : cat.titleEn });
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
          <img src={logo} alt="Fakebook Logo" className="help-logo-icon" onClick={() => onBack ? onBack() : navigate('/')} style={{cursor: 'pointer'}} />
          <span className="help-logo-text" onClick={(e) => { e.stopPropagation(); onBack ? onBack() : navigate('/'); }} style={{cursor: 'pointer'}}>Help Centre</span>
        </div>
        
        {/* Only show search in header if in article view */}
        {activeArticle && (
          <div className="help-header-search">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search help articles..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="help-header-right">
          <button className="lang-btn" onClick={() => setIsVi(!isVi)}>
            <FaGlobe /> {isVi ? 'Tiếng Việt' : 'English (UK)'}
          </button>
        </div>
      </header>

      <div className="help-main-layout">
        {/* Sidebar */}
        <aside className="help-sidebar">
          <nav className="help-sidebar-nav">
            {HELP_CATEGORIES.map((cat: any) => (
              <div key={cat.id} className="help-nav-group">
                <button 
                  className={`help-nav-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat)}
                >
                  <div className="cat-btn-left">
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-title">{isVi ? cat.titleVi : cat.titleEn}</span>
                  </div>
                  <FaChevronDown className={`cat-chevron ${activeCategory === cat.id ? 'open' : ''}`} />
                </button>
                
                {activeCategory === cat.id && (
                  <div className="help-nav-articles">
                    {cat.articles.map((art: any) => (
                      <button 
                        key={art.id} 
                        className={`help-nav-art-btn ${activeArticle?.id === art.id ? 'active' : ''}`}
                        onClick={() => handleArticleClick(art, cat)}
                      >
                        {isVi ? art.titleVi : art.titleEn}
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
                <h1>Hey, how can I help?</h1>
                <div className="help-hero-search">
                  <input 
                    type="text" 
                    placeholder="Ask a question or describe your issue..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="search-submit-btn">
                    <FaArrowLeft style={{transform: 'rotate(90deg)'}} />
                  </button>
                </div>
                <p className="help-hero-terms">
                  By using this service, you agree to Group 36's terms.
                </p>
              </div>

              <div className="help-popular-topics">
                <h2>Popular topics</h2>
                
                <div className="help-banner-blue">
                  <div className="banner-icon-bg">
                    <FaKey className="banner-icon" />
                  </div>
                  <div className="banner-text">
                    <h3>Need help with logging in?</h3>
                    <p>Learn what to do if you're having trouble with getting back on Fakebook.</p>
                  </div>
                  <button className="banner-btn">Get Help</button>
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
                  <h2>Other ways to get help</h2>
                  <div className="help-action-card">
                    <div className="action-left">
                      <FaSearch className="action-icon" />
                      <div>
                        <h3>Search Help Centre</h3>
                        <p>Find answers to common questions</p>
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
                <span className="current">{isVi ? activeArticle.titleVi : activeArticle.titleEn}</span>
              </div>
              
              <h1 className="article-main-title">{isVi ? activeArticle.titleVi : activeArticle.titleEn}</h1>
              
              <div className="article-pill-buttons">
                <button className="pill-btn"><FaFileAlt style={{marginRight: 8, color: '#1877f2'}}/> {isVi ? activeArticle.titleVi : activeArticle.titleEn}</button>
                <button className="pill-btn">I have a different question</button>
              </div>

              <div className="article-content-body">
                {isVi ? activeArticle.contentVi : activeArticle.contentEn}
              </div>
              
              <div className="article-feedback">
                <div className="feedback-box">
                  <h3>Was this helpful?</h3>
                  <div className="feedback-btns">
                    <button>Yes</button>
                    <button>No</button>
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
