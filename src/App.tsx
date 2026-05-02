import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, Plus, Trash2, Youtube, Image as ImageIcon, Link as LinkIcon, Home, Settings, LogOut, LogIn, ChevronRight, FileText, Globe, Video, MessageCircle, User as UserIcon, Search, FileX, ArrowRight, RefreshCw, ShoppingBag, Zap } from 'lucide-react';

// --- Helpers ---
const ensureAbsoluteUrl = (url: string) => {
  if (!url || url === '#' || url === '') return url;
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#')) return trimmedUrl;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl)) {
    return trimmedUrl;
  }
  return `https://${trimmedUrl}`;
};

// --- Types ---
interface Blog {
  id: string;
  title: string;
  type: 'internal' | 'external';
  link?: string;
  content?: string;
  footerImageUrl?: string;
  footerImageLink?: string;
  imageAlt?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaImageUrl?: string;
  youtubeId?: string;
  comment?: string;
  aspectRatio?: '9:16' | '16:9';
  bannerCode?: string;
}

interface Product {
  id: string;
  imageUrl: string;
  imageAlt?: string;
  title: string;
  link: string;
  buttonText: string;
  content?: string;
  youtubeId?: string;
  comment?: string;
  aspectRatio?: '9:16' | '16:9';
}

interface LandingConfig {
  siteId?: string;
  mainTitle?: string;
  mainImageUrl: string;
  mainImageAlt?: string;
  mainContent?: string;
  mainYoutubeId?: string;
  mainComment?: string;
  mainAspectRatio?: '9:16' | '16:9';
  priceLink: string;
  ctaText?: string;
  ctaImageUrl?: string;
  blogs: Blog[];
  youtubes: string[];
  youtubeAspectRatios?: string[];
  youtubeComments: string[];
  products?: Product[];
  footerNotice?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

const DEFAULT_CONFIG: LandingConfig = {
  siteId: '1688',
  mainTitle: '🔥 지금 가장 많이 찾는 상품',
  mainImageUrl: 'https://picsum.photos/seed/vibrant/1920/1080?blur=4',
  mainImageAlt: '',
  mainContent: '',
  mainYoutubeId: '',
  mainComment: '',
  priceLink: 'https://www.coupang.com',
  blogs: [
    { id: '1', title: '에어컨 전기세 절약 방법', type: 'external', link: '#' },
    { id: '2', title: '가성비 노트북 추천', type: 'external', link: '#' },
    { id: '3', title: '비타민 제대로 고르는 법', type: 'external', link: '#' },
    { id: '4', title: '다이어트 실패하는 이유', type: 'external', link: '#' },
    { id: '5', title: '무선 이어폰 순위 TOP5', type: 'external', link: '#' },
    { id: '6', title: '쿠팡 최저가 찾는 법', type: 'external', link: '#' },
  ],
  youtubes: ['', ''],
  youtubeAspectRatios: ['9:16', '9:16'],
  youtubeComments: ['', ''],
  products: [],
  footerNotice: '※ 이 게시물은 쿠팡 파트너스 활동의 일환으로\n일정액의 수수료를 제공받습니다.',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: ''
};

const ALI_DEFAULT_SEO_TITLE = '알리.com ㅣ 알리익스프레스 직구 베스트 상품 추천 특가 할인 정보';
const ALI_DEFAULT_SEO_DESC = '알리익스프레스 직구 방법부터 인기 상품 추천, 할인 정보까지 한눈에 확인하세요. 알리.com에서 해외직구 초보도 쉽게 쇼핑 가이드를 만나보세요.';
const ALI_DEFAULT_SEO_KEYWORDS = '알리익스프레스, 알리, 직구, 해외직구, 알리할인코드, 알리특가, 알리쿠폰';

const KR1688_DEFAULT_SEO_TITLE = '일육팔팔.com ㅣ 1688 중국 도매 사이트 상품 소싱 구매대행 전문';
const KR1688_DEFAULT_SEO_DESC = '중국 1688(일육팔팔) 도매 상품 소싱부터 구매대행, 위탁판매까지! 국내 핫딜과 최저가 쇼핑 정보를 일육팔팔.com에서 확인하세요.';
const KR1688_DEFAULT_SEO_KEYWORDS = '1688, 일육팔팔, 중국도매, 구매대행, 위탁판매, 소싱, 최저가쇼핑';

// --- Components ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorMsg: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isNetworkError = this.state.errorMsg.includes('서버 접속') || this.state.errorMsg.includes('unavailable');
      
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isNetworkError ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'}`}>
            {isNetworkError ? <Globe size={40} /> : <Settings size={40} />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isNetworkError ? '인터넷 연결 확인 필요' : '문제가 발생했습니다'}
          </h2>
          <p className="mt-4 text-gray-500 max-w-md mx-auto leading-relaxed">
            {this.state.errorMsg}
          </p>
          <div className="flex flex-col gap-3 mt-8">
            <button 
              onClick={() => window.location.reload()} 
              className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
            >
              다시 시도하기
            </button>
            <p className="text-xs text-gray-400">문제가 지속되면 잠시 후 다시 접속해 주세요.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const getAccentColor = (siteId: string) => {
  if (siteId === 'ali') return '#FF4747';
  if (siteId === 'vitamin') return '#2e7d32';
  return '#ff5722';
};

// SEO Component
const SEO = ({ title, description, keywords, siteName }: { title?: string, description?: string, keywords?: string, siteName?: string }) => {
  const currentSiteId = getSiteId();
  const isAli = currentSiteId === 'ali';
  const isVitamin = currentSiteId === 'vitamin';
  
  // Site specific defaults
  const defaultSiteName = siteName || (isAli ? '알리.com' : (isVitamin ? '비타민.kr' : '일육팔팔.com'));
  const defaultTitle = isAli ? ALI_DEFAULT_SEO_TITLE : (isVitamin ? '가성비 영양제 추천 비타민.kr' : KR1688_DEFAULT_SEO_TITLE);
  const defaultDesc = isAli ? ALI_DEFAULT_SEO_DESC : (isVitamin ? '비타민부터 유산균까지, 꼭 필요한 영양제 가성비 있게 선택하는 법!' : KR1688_DEFAULT_SEO_DESC);
  const defaultKeywords = isAli ? ALI_DEFAULT_SEO_KEYWORDS : (isVitamin ? '비타민, 영양제, 멀티비타민, 유산균, 가성비영양제' : KR1688_DEFAULT_SEO_KEYWORDS);

  let fullTitle = title ? (title.includes(defaultSiteName) ? title : `${title} | ${defaultSiteName}`) : defaultTitle;
  
  // Naver/Google recommendations
  if (fullTitle.length > 50) fullTitle = fullTitle.substring(0, 47) + '...';

  let metaDesc = description || defaultDesc;
  if (metaDesc.length > 100) metaDesc = metaDesc.substring(0, 97) + '...';

  const currentUrl = window.location.href;
  
  return (
    <Helmet>
      <html lang="ko" />
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={defaultSiteName} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />
    </Helmet>
  );
};

// NotFound Component
  const SearchBar = ({ initialQuery = '', siteId = '1688' }: { initialQuery?: string, siteId?: string }) => {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}${siteId === 'vitamin' ? '&site=vitamin' : (siteId === 'ali' ? '&site=ali' : '')}`);
    }
  };

  const currentSiteId = getSiteId();
  const accentColor = getAccentColor(currentSiteId);
  const isAliOrVitamin = currentSiteId === 'ali' || currentSiteId === 'vitamin';

  return (
    <div className="w-full max-w-xl mx-auto mb-4 px-4">
      <form onSubmit={handleSearch} className="relative group">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentSiteId === 'ali' ? "알리익스프레스 상품 검색..." : "쿠팡 실시간 상품 검색..."}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white p-2 rounded-xl transition-colors shadow-md"
          style={{ backgroundColor: accentColor }}
        >
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};

const SearchPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const q = searchParams.get('q') || '';
  const site = searchParams.get('site') || '1688';
  const [results, setResults] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q) {
      performSearch();
    }
  }, [q]);

  const performSearch = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const apiPath = site === 'ali' ? '/api/ali/search' : '/api/coupang/search';
      const response = await axios.get(`${apiPath}?keyword=${encodeURIComponent(q)}`, {
        timeout: 20000, // 20 seconds
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Defensively check if response is JSON (if it's a string, it might be HTML)
      if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE')) {
        throw new Error("서버로부터 올바르지 않은 응답 형식을 받았습니다. (HTML 응답)");
      }
      
      if (typeof response.data !== 'object' || response.data === null) {
        throw new Error("서버로부터 올바르지 않은 응답 형식을 받았습니다. (데이터 누락)");
      }

      const data = response.data.data || [];
      
      if (data.length === 0) {
        // Extreme client-side fallback if server fails to provide even fallback data
        setResults([
          {
            productId: `cfb_1`,
            productName: `[특별추천] ${q} 인기 순위 1위 상품`,
            productPrice: 48900,
            productImage: "https://picsum.photos/seed/shop1/400/400",
            productUrl: "https://www.coupang.com",
            isMock: true
          },
          {
            productId: `cfb_2`,
            productName: `[가성비] ${q} 실속형 베스트 모델`,
            productPrice: 29500,
            productImage: "https://picsum.photos/seed/shop2/400/400",
            productUrl: "https://www.coupang.com",
            isMock: true
          },
          {
            productId: `cfb_3`,
            productName: `[인기상품] ${q} 프리미엄 패키지`,
            productPrice: 89000,
            productImage: "https://picsum.photos/seed/shop3/400/400",
            productUrl: "https://www.coupang.com",
            isMock: true
          }
        ]);
      } else {
        setResults(data);
      }

      if (response.data.debug_info) {
        setDebugInfo(response.data.debug_info);
      }
    } catch (err: any) {
      console.error("Search failed:", err);
      const statusCode = err.response?.status;
      const statusText = err.response?.statusText || err.message;
      setError(`상품 검색 중 오류가 발생했습니다 (${statusCode || '서버 응답 없음'}: ${statusText}).`);
      
      setDebugInfo({
        error: err.message,
        status: statusCode,
        statusText: statusText,
        url: err.config?.url,
        tip: "Netlify 배포 시 /api 경로가 /netlify/functions/api로 정확히 연결되었는지 확인해 주세요."
      });
    } finally {
      setLoading(false);
    }
  };

  const isVitamin = site === 'vitamin';
  const isAli = site === 'ali';
  const accentColor = getAccentColor(site);

  // Function to get product URL based on siteId
  const getProductUrl = (rawUrl: string) => {
    try {
      const url = new URL(rawUrl);
      
      if (isAli) {
        // --- 알리.com 전용 로직 ---
        // 쿠팡 코드를 절대 붙이지 않음
        url.searchParams.delete('subId');
        url.searchParams.delete('ctag');
        url.searchParams.delete('lptag');

        // 향후 알리익스프레스 제휴 코드가 있다면 여기에 추가 (예: VITE_ALI_TRACKING_ID)
        const aliTrackingId = import.meta.env.VITE_ALI_TRACKING_ID;
        if (aliTrackingId) {
          // 알리 제휴 파라미터 구조에 맞게 세팅 (나중에 코드 나오면 수정 가능)
          // url.searchParams.set('aff_id', aliTrackingId); 
        }
        return url.toString();
      }
      
      if (isVitamin) {
        // 비타민 사이트 (기존 유지)
        url.searchParams.delete('subId');
        url.searchParams.delete('ctag');
        url.searchParams.delete('lptag');
        return url.toString();
      } else {
        // 일육팔팔.com (기존 쿠팡 코드 유지)
        const trackingId = import.meta.env.VITE_COUPANG_TRACKING_ID;
        if (trackingId && !url.searchParams.has('subId')) {
          url.searchParams.set('subId', trackingId);
        }
        return url.toString();
      }
    } catch (e) {
      return rawUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-[800px] mx-auto bg-white min-h-screen shadow-lg">
        <div className="p-6">
          <Link 
            to={isVitamin ? '/?site=vitamin' : (isAli ? '/?site=ali' : '/')} 
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8 font-medium"
          >
            <Home size={18} /> 홈으로 돌아가기
          </Link>

          <h1 className="text-[21px] font-black text-gray-900 mb-4 flex items-center gap-2 leading-tight">
            <span style={{ color: accentColor }}>"{q}"</span> 쇼핑 검색 결과
          </h1>

          <SearchBar initialQuery={q} siteId={site} />
          <p className="text-[#999] text-[10px] mt-[-10px] mb-4 text-center leading-tight">
            {isAli ? '※ 본 서비스는 알리익스프레스 정보를 포함할 수 있습니다.' : '※ 이 게시물은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다'}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-3 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 bg-blue-600 rounded-full" />
              <h2 className="text-[18px] sm:text-[21px] font-black text-gray-900 leading-none">
                {results.some(r => r.isMock || (typeof r.productId === 'string' && (r.productId.startsWith('fb_') || r.productId.startsWith('cfb_')))) 
                  ? '추천 쇼핑 리스트' 
                  : <>{isAli ? '[ 알리 실시간 검색 결과' : '[ 쿠팡 실시간 검색 결과'} <span className={isAli ? "text-red-500 mx-1 text-base font-bold" : "text-blue-500 mx-1 text-base font-bold"}>{results.length > 0 ? results.length : '...'}선</span> ]</>
                }
              </h2>
            </div>
            {results.length > 0 && (
              <span className="text-xs text-gray-400 font-bold bg-gray-50 px-3 py-1.5 rounded-full">
                {results.some(r => r.isMock || (typeof r.productId === 'string' && (r.productId.startsWith('fb_') || r.productId.startsWith('cfb_')))) ? '데이터 수집 중 (일반 추천)' : `인기 순위 ${results.length}개 발견`}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="mx-auto animate-spin mb-4" style={{ color: accentColor }} size={40} />
              <p className="text-gray-500 font-medium font-sans">{isAli ? '알리 실시간 상품 정보를 불러오는 중...' : '쿠팡 실시간 상품 정보를 불러오는 중...'}</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center bg-red-50 rounded-3xl p-8">
              <FileX className="mx-auto text-red-400 mb-4" size={40} />
              <p className="text-red-600 font-bold">{error}</p>
              {debugInfo && (
                <div className="mt-4 p-2 bg-red-100 rounded text-[10px] text-red-700 font-mono break-all text-left">
                  Debug: {JSON.stringify(debugInfo)}
                </div>
              )}
              <button 
                onClick={performSearch}
                className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl font-bold"
              >
                다시 시도
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {results.map((product: any, i) => (
                <motion.div 
                  key={`${product.productId}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row"
                >
                  <div className="w-full sm:w-1/3 aspect-square overflow-hidden bg-gray-50 flex-shrink-0 relative group border-b sm:border-b-0 sm:border-r border-gray-100">
                    <img 
                      src={product.productImage} 
                      alt={product.productName}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // Use unique placeholder if image fails
                        if (!target.src.includes('picsum.photos')) {
                          target.src = `https://picsum.photos/seed/${product.productId || Math.random()}/400/400?grayscale`;
                        }
                      }}
                    />
                  </div>
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between overflow-hidden">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {product.productName}
                      </h3>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl sm:text-2xl font-black text-red-600">
                            {product.productPrice.toLocaleString()}원
                          </span>
                          {product.isMock && (
                            <span className="bg-gray-100 text-gray-400 text-[8px] px-1 rounded">추천</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                          <Zap size={10} /> 무료배송
                        </div>
                      </div>
                    </div>
                    
                    <a 
                      href={getProductUrl(product.productUrl)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-4 w-full py-3 sm:py-4 text-white rounded-xl sm:rounded-2xl font-black text-center shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                      style={{ backgroundColor: accentColor }}
                    >
                      <ShoppingBag size={18} className="sm:w-5 sm:h-5" />
                      {isAli ? '알리 최저가 확인 및 구매하기' : '쿠팡 최저가 확인 및 구매하기'}
                    </a>
                  </div>
                </motion.div>
              ))}

      {/* --- 🛒 쿠팡쇼핑을 추천하는 이유 섹션 --- */}
              <div 
                className="mt-12 bg-white rounded-[2rem] p-6 sm:p-8 md:p-10 border border-gray-100 shadow-sm relative z-10 block"
              >
                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-8 flex items-center justify-center text-center">
                  <span className="mr-3">🛒</span> {isAli ? '알리 쇼핑을 추천하는 이유' : '쿠팡 쇼핑을 추천하는 이유'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-6 rounded-3xl transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 flex flex-col items-center text-center group">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">{isAli ? '💸' : '🚀'}</div>
                    <h4 className="font-extrabold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{isAli ? '압도적 가성비' : '로켓배송 (빠른 배송)'}</h4>
                    <p className="text-[12px] sm:text-sm text-gray-600 leading-relaxed font-medium">{isAli ? '중간 유통 없는 직구로\n국내보다 훨씬 저렴하게!' : '오늘 주문하면 내일 도착!\n급한 물건도 OK'}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 flex flex-col items-center text-center group">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-4 group-hover:scale-110 transition-transform">{isAli ? '📦' : '⭐'}</div>
                    <h4 className="font-extrabold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{isAli ? '초이스 배송 (빠른 직구)' : '솔직한 리뷰 시스템'}</h4>
                    <p className="text-[12px] sm:text-sm text-gray-600 leading-relaxed font-medium">{isAli ? '5일~7일 내 빠른 무료배송\n이제 직구도 기다림 없이!' : '리뷰가 많아서 상품 선택시\n실패 확률 낮아요 👀'}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 flex flex-col items-center text-center group">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-4 group-hover:scale-110 transition-transform">{isAli ? '🌏' : '🔄'}</div>
                    <h4 className="font-extrabold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{isAli ? '전세계 인기 셀렉션' : '쉬운 반품·환불'}</h4>
                    <p className="text-[12px] sm:text-sm text-gray-600 leading-relaxed font-medium">{isAli ? '국내에서 구하기 힘든\n유니크하고 트렌디한 상품들' : '간편한 반품, 복잡한 절차 없이\n빠른 처리로 편해요 🙌'}</p>
                  </div>
                </div>
              </div>
              
              {results.length > 0 && results.some(r => r.isMock || (typeof r.productId === 'string' && (r.productId.startsWith('fb_') || r.productId.startsWith('cfb_')))) && (
                <div className="mt-12 pt-8 border-t border-dashed border-gray-100">
                  <details className="group">
                    <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 flex items-center justify-center gap-1 list-none">
                      <Settings size={10} className="group-open:rotate-90 transition-transform" />
                      개발자 디버그 정보 (Netlify 배포 시 확인용)
                    </summary>
                    <div className="mt-4 p-4 bg-gray-50 rounded-2xl text-[10px] text-gray-500 font-mono overflow-auto max-h-[300px] border border-gray-100 italic">
                      <div className="font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1 flex justify-between not-italic">
                        <span>API Debug Status</span>
                        <span className="text-red-500 uppercase">Warning: Fallback Active</span>
                      </div>
                      <div className="space-y-2">
                        <p>• Endpoint: {window.location.origin}{isAli ? '/api/ali/search' : '/api/coupang/search'}</p>
                        <p>• Fallback Type: {results.some(r => r.productId?.startsWith('cf_') || r.productId?.startsWith('ali_')) ? 'Client-side' : 'Server-side'}</p>
                        {debugInfo ? (
                          <div>
                            <p className="font-bold mt-2 text-gray-700 not-italic">Server Response Log:</p>
                            <pre className="mt-1 whitespace-pre-wrap bg-white p-2 rounded border border-gray-100">{JSON.stringify(debugInfo, null, 2)}</pre>
                          </div>
                        ) : (
                          <div className="p-3 bg-red-50 border border-red-100 rounded-xl mt-2 text-red-600 not-italic">
                             <p className="font-bold mb-1">⚠️ 백엔드 서버(Node.js) 미응답</p>
                             <p className="leading-relaxed">
                               현재 Netlify로 배포하신 것으로 보입니다. Netlify는 정적 사이트 호스팅이므로 `server.ts`와 같은 Express 서버가 자동으로 실행되지 않습니다. 
                               <br /><br />
                               이 기능을 정상 작동시키려면:
                               <br />1. AI Studio의 **'Share'** 기능을 통해 제공되는 Cloud Run URL을 그대로 사용하시거나,
                               <br />2. Netlify Functions를 별도로 설정하셔야 합니다.
                             </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              )}
              
              <div className="mt-12 p-8 bg-blue-50 rounded-3xl text-center">
                <p className="text-blue-800 font-medium mb-2">실시간 최저가 정보는 매 순간 변동될 수 있습니다.</p>
                <p className="text-blue-600 text-sm">※ 이 게시물은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다</p>
              </div>

              <div className="mt-12 flex justify-center">
                <Link 
                  to={isVitamin ? '/?site=vitamin' : '/'} 
                  className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Home size={20} />
                  다른 상품 소싱하러 홈으로 가기
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="bg-gray-50 rounded-3xl p-12 border border-dashed border-gray-200 mb-8">
                <Search className="mx-auto text-gray-300 mb-4" size={60} />
                <p className="text-xl font-bold text-gray-400">검색 결과가 없습니다.</p>
                <p className="mt-2 text-gray-400">다른 키워드로 검색해 보세요.</p>
                
                {debugInfo && (
                  <div className="mt-8 p-4 bg-white rounded-xl border border-gray-100 text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Diagnostic Info</p>
                    <div className="text-[10px] text-gray-400 font-mono break-all bg-gray-50 p-2 rounded">
                      {JSON.stringify(debugInfo)}
                    </div>
                    <p className="mt-2 text-[10px] text-red-400">
                      * 쿠팡 API 키가 올바른지, 도메인이 'https://1688mall.kr'로 등록되어 있는지 확인해주세요.
                    </p>
                  </div>
                )}
              </div>
              
              <Link 
                to={isVitamin ? '/?site=vitamin' : '/'} 
                className="inline-flex px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold items-center gap-2 transition-all transform active:scale-95"
              >
                <Home size={20} />
                홈으로 돌아가기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NotFound = () => {
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();
  const siteId = getSiteId();
  const siteName = SITES.find(s => s.id === siteId)?.name || '일육팔팔.com';

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    const redirect = setTimeout(() => {
      navigate(siteId === 'vitamin' ? '/?site=vitamin' : '/');
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, [navigate, siteId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5 text-center">
      <SEO title="페이지를 찾을 수 없습니다" siteName={siteName} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100"
      >
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Search size={40} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-4 break-keep">
          요청하신 페이지를<br />찾을 수 없습니다
        </h1>
        <p className="text-gray-500 mb-8 break-keep leading-relaxed">
          주소가 변경되었거나 삭제되었을 수 있습니다.<br />
          잠시 후 메인 페이지로 이동합니다.
        </p>
        <div className="flex flex-col gap-3">
          <div className="text-sm font-bold text-blue-600 bg-blue-50 py-2 rounded-full">
            {countdown}초 후 자동 이동
          </div>
          <Link 
            to={siteId === 'vitamin' ? '/?site=vitamin' : '/'}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
          >
            지금 메인으로 가기
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

const PostPage = () => {
  const location = useLocation();
  const { target, id } = useParams();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [priceLink, setPriceLink] = useState('');
  const [footerNotice, setFooterNotice] = useState('');
  const [youtubes, setYoutubes] = useState<string[]>([]);
  const [youtubeAspectRatios, setYoutubeAspectRatios] = useState<string[]>([]);
  const [youtubeComments, setYoutubeComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const siteId = getSiteId();
  const siteName = SITES.find(s => s.id === siteId)?.name;
  const categories = getCategories(siteId);
  const accentColor = getAccentColor(siteId);

  useEffect(() => {
    if (!target || !id) return;
    const siteId = getSiteId();
    
    // Use old paths for 1688 and vitamin to restore/unify data, new paths for others for isolation
    const docRef = (siteId === '1688' || siteId === 'vitamin')
      ? (target === 'landing' ? doc(db, 'config', 'landing') : doc(db, 'categories', target))
      : (target === 'landing' ? doc(db, 'config', `landing_${siteId}`) : doc(db, 'categories', `${siteId}_${target}`));

    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LandingConfig;
        setBlogs(data.blogs || []);
        setPriceLink(data.priceLink || '');
        setFooterNotice(data.footerNotice || '');
        setYoutubes(data.youtubes || []);
        setYoutubeAspectRatios(data.youtubeAspectRatios || []);
        setYoutubeComments(data.youtubeComments || []);
        const found = data.blogs?.find(b => String(b.id) === String(id));
        if (found) {
          setBlog(found);
        } else {
          console.error("Blog not found in config:", id, data.blogs);
          setBlog(null);
        }
        setLoading(false);
      } else if (siteId === 'vitamin') {
        // Fallback to 1688 data for Vitamin site if its own data is missing
        const fallbackRef = target === 'landing' ? doc(db, 'config', 'landing') : doc(db, 'categories', target);
        getDoc(fallbackRef).then(fallbackSnap => {
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data() as LandingConfig;
            setBlogs(data.blogs || []);
            setPriceLink(data.priceLink || '');
            setFooterNotice(data.footerNotice || '');
            setYoutubes(data.youtubes || []);
            setYoutubeAspectRatios(data.youtubeAspectRatios || []);
            setYoutubeComments(data.youtubeComments || []);
            const found = data.blogs?.find(b => String(b.id) === String(id));
            if (found) {
              setBlog(found);
            } else {
              setBlog(null);
            }
          } else {
            setBlog(null);
          }
          setLoading(false);
        }).catch(() => {
          setBlog(null);
          setLoading(false);
        });
      } else {
        console.error("Document does not exist:", docRef.path);
        setBlog(null);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, target === 'landing' ? `config/landing_${siteId}` : `categories/${siteId}_${target}`);
      setLoading(false);
    });
    return () => unsub();
  }, [target, id, siteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#ff5722] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!blog) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5 text-center">
      <SEO title="포스트를 찾을 수 없습니다" siteName={siteName} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100"
      >
        <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileX size={40} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-4 break-keep">
          찾으시는 상품 정보가<br />변경되었거나 삭제되었습니다
        </h1>
        <p className="text-sm text-gray-500 mb-8 break-keep leading-relaxed">
          요청하신 주소의 컨텐츠를 찾을 수 없어<br />
          잠시 후 메인 페이지로 안전하게 안내해 드립니다.
        </p>
        <div className="flex flex-col gap-3">
          <Link 
            to={siteId === 'vitamin' ? '/?site=vitamin' : '/'}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
          >
            메인 페이지로 이동
          </Link>
        </div>
      </motion.div>
      <script>
        {`setTimeout(() => { window.location.href = "${siteId === 'vitamin' ? '/?site=vitamin' : '/'}"; }, 5000);`}
      </script>
    </div>
  );

  const ctaText = blog.ctaText;
  const ctaLink = ensureAbsoluteUrl(blog.ctaLink || priceLink);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white font-sans pb-20"
    >
      <SEO 
        title={blog.title} 
        description={blog.content?.substring(0, 160)} 
        siteName={siteName}
      />
      <ScrollToTop />
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-0">
        <SearchBar siteId={siteId} />
      </div>
      <div className="max-w-2xl mx-auto px-5 pt-2 pb-10">
        <button onClick={() => window.history.back()} className="inline-flex items-center text-gray-500 mb-3 hover:text-black text-xs">
          <ChevronRight className="rotate-180 mr-1" size={16} /> 뒤로가기
        </button>
        
        {/* 1. 제목 (Title) */}
        <h1 className="text-[18px] font-bold mb-3 break-keep text-center leading-tight">{blog.title}</h1>
        
        {/* 2. 상품 (Main Image) */}
        {blog.footerImageUrl && (
          <div className="mb-3">
            <div className="overflow-hidden rounded-2xl shadow-sm">
              {blog.footerImageLink ? (
                <a href={ensureAbsoluteUrl(blog.footerImageLink)} target="_blank" rel="noopener noreferrer" className="block">
                  <img 
                    src={blog.footerImageUrl} 
                    alt={blog.imageAlt || blog.title} 
                    className="w-full h-auto border-none hover:scale-[1.02] transition-transform max-h-[320px]" 
                    referrerPolicy="no-referrer" 
                  />
                </a>
              ) : (
                <img 
                  src={blog.footerImageUrl} 
                  alt={blog.imageAlt || blog.title} 
                  className="w-full h-auto border-none max-h-[320px]" 
                  referrerPolicy="no-referrer" 
                />
              )}
            </div>
          </div>
        )}

        {/* 3. 내용 (Content) */}
        <div className="markdown-body prose prose-slate max-w-none break-words mb-1 text-[15px]">
          {blog.content ? (
            <Markdown remarkPlugins={[remarkGfm]}>{blog.content}</Markdown>
          ) : (
            <p className="text-gray-500 italic text-center">내용이 없습니다.</p>
          )}
        </div>

        {/* 쿠팡 배너 (Banner) */}
        {blog.bannerCode && (
          <div className="mb-4 flex justify-center overflow-hidden rounded-xl">
            <div 
              className="max-w-full"
              dangerouslySetInnerHTML={{ __html: blog.bannerCode }} 
            />
          </div>
        )}

        {/* 4, 5, 6. 쇼츠 + 코멘트 + CTA (한 세트로 묶음) */}
        <div className="space-y-2 bg-gray-50/50 p-3 rounded-2xl shadow-sm mb-6 border border-gray-100">
          {/* 4. 쇼츠 (YouTube Shorts) */}
          {blog.youtubeId && (
            <div className={`w-full mx-auto rounded-2xl overflow-hidden shadow-sm mb-1 ${blog.aspectRatio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[280px]'}`}>
              <iframe 
                src={`https://www.youtube.com/embed/${blog.youtubeId}`} 
                className="w-full h-full border-none"
                allowFullScreen
                title="YouTube Shorts"
              ></iframe>
            </div>
          )}

          {/* 5. 코멘트 (Comment) */}
          {blog.comment && (
            <div className="bg-white/90 p-3 rounded-xl italic text-blue-800 text-[13px] break-keep text-center shadow-sm">
              "{blog.comment}"
            </div>
          )}

          {/* 6. CTA (Button) */}
          {ctaText && (
            <div className="flex justify-center pt-0">
              {blog.ctaImageUrl ? (
                <a href={ctaLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto block overflow-hidden rounded-xl shadow-md hover:scale-[1.02] transition-transform max-w-full sm:max-w-[350px] border-none text-center">
                  <img src={blog.ctaImageUrl} alt={ctaText} className="w-full h-auto border-none" referrerPolicy="no-referrer" />
                  <div className="text-white p-3 font-bold text-base" style={{ backgroundColor: accentColor }}>
                    👉 {ctaText}
                  </div>
                </a>
              ) : (
                <a href={ctaLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white px-5 py-3 rounded-xl font-bold text-[15px] shadow-md hover:scale-105 transition-transform" style={{ backgroundColor: accentColor }}>
                  👉 {ctaText}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Blog Grid (놓치기 아까운 상품 다시보기) */}
        <div className="mt-16 font-bold mb-6 text-center" style={{ color: accentColor }}>
          놓치기 아까운 상품 다시보기
        </div>
        <div className="grid grid-cols-2 gap-3 mb-8">
          {blogs.map((b, i) => {
            const isExternal = b.type === 'external';
            const targetPath = isExternal ? ensureAbsoluteUrl(b.link || '') : `/post/${target}/${b.id}${siteId === 'vitamin' ? '?site=vitamin' : ''}`;
            const className = "bg-white p-4 rounded-xl text-sm text-gray-700 shadow-sm hover:-translate-y-1 transition-transform text-center block truncate border-none outline-none";
            
            if (isExternal) {
              return (
                <a key={i} href={targetPath || '#'} target="_blank" rel="noopener noreferrer" className={className}>
                  {b.title}
                </a>
              );
            }

            return (
              <Link key={i} to={targetPath || '#'} className={className}>
                {b.title}
              </Link>
            );
          })}
        </div>

        {/* Bottom YouTube & Comments Section (New) */}
        {((youtubes && youtubes.some(id => id)) || (youtubeComments && youtubeComments.some(c => c))) && (
          <div className="mt-16 space-y-12">
            {youtubes && youtubes.some(id => id) && (
              <div className="flex flex-wrap justify-center gap-6">
                {youtubes.map((id, i) => {
                  if (!id) return null;
                  const ratio = (youtubeAspectRatios && youtubeAspectRatios[i]) || '9:16';
                  const isOnlyOne = youtubes.filter(v => v).length === 1;
                  return (
                    <div key={i} className={`${isOnlyOne ? 'w-full' : 'w-full md:w-[calc(50%-12px)]'} mx-auto rounded-2xl overflow-hidden shadow-lg ${ratio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                      <iframe 
                        src={`https://www.youtube.com/embed/${id}`}
                        title={`YouTube video ${i}`}
                        className="w-full h-full border-none"
                        allowFullScreen
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {youtubeComments && youtubeComments.some(c => c) && (
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                  <MessageCircle className="text-blue-600" /> 실시간 코멘트
                </h2>
                <div className="space-y-4">
                  {youtubeComments.map((comment, i) => {
                    if (!comment) return null;
                    return (
                      <motion.div 
                        key={i}
                        initial={{ x: -20, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <UserIcon size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900 mb-1">익명 사용자</div>
                          <div className="text-gray-700 text-sm break-keep">{comment}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back to Home Button */}
        <div className="mt-12 text-center">
          <Link 
            to={siteId === '1688' ? '/' : (siteId === 'vitamin' ? '/?site=vitamin' : '/?site=ali')}
            className="inline-flex items-center gap-2 px-8 py-3 text-white rounded-full font-bold shadow-md hover:scale-105 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            🏠 홈으로 가기
          </Link>
        </div>

        {footerNotice && (
          <div className="text-[14px] text-gray-400 mt-16 leading-relaxed whitespace-pre-wrap border-t pt-6 text-center">
            {footerNotice}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const CATEGORIES = [
  { id: "1688", name: "🔥 초저가 중국도매 (1688)", color: "bg-blue-100", main: true },
  { id: "aliexpress", name: "💰 가성비 해외직구 (알리/테무)", color: "bg-green-100", main: true },
  { id: "amazon", name: "🌍 글로벌 베스트셀러 (아마존)", color: "bg-pink-100", main: true },
  { id: "iherb", name: "💊 건강 직구 전문 (아이허브)", color: "bg-yellow-100", main: true },
  { id: "coupang", name: "🚀 빠른 로켓배송 (쿠팡)", color: "bg-blue-100", main: false },
  { id: "naver", name: "🛍️ 네이버 인기상품 (스마트스토어)", color: "bg-green-100", main: false },
  { id: "fashion", name: "👗 요즘 뜨는 패션템", color: "bg-pink-100", main: false },
  { id: "kitchen", name: "🍳 생활·주방 핫딜", color: "bg-yellow-100", main: false }
];

const getCategories = (siteId: string) => {
  if (siteId === 'ali') {
    return [
      { id: "clothing", name: "👗👔 남녀 의류", color: "bg-red-50", main: true },
      { id: "appliances", name: "🔌 가전제품", color: "bg-orange-50", main: true },
      { id: "toys", name: "🎮 장난감 및 게임", color: "bg-yellow-50", main: true },
      { id: "shoes", name: "👟 신발", color: "bg-gray-50", main: true },
      { id: "pet", name: "🐾 애완동물 용품", color: "bg-pink-50", main: false },
      { id: "phone", name: "📱 휴대폰 및 액세서리", color: "bg-blue-50", main: false },
      { id: "jewelry", name: "💍 쥬얼리 및 액세서리", color: "bg-purple-50", main: false },
      { id: "office", name: "💻 사무실 및 학교 용품", color: "bg-green-50", main: false }
    ];
  }
  if (siteId === 'vitamin') {
    return [
      { id: "1688", name: "💊 필수 영양제 (가성비 종합비타민)", color: "bg-blue-100" },
      { id: "aliexpress", name: "🐟 혈행 건강 (오메가3/비타민 조합)", color: "bg-green-100" },
      { id: "amazon", name: "🏃 다이어트 & 헬스 (체력 영양제)", color: "bg-pink-100" },
      { id: "iherb", name: "🧿 장 건강 (유산균/면역력 비타민)", color: "bg-yellow-100" },
      { id: "coupang", name: "👁️ 눈 피로 심할때 (루테인/지아잔틴)", color: "bg-blue-100" },
      { id: "naver", name: "🌿 간 건강 (밀크씨슬/피로회복)", color: "bg-green-100" },
      { id: "fashion", name: "🦴 관절 & 뼈 건강 (MSM/칼슘)", color: "bg-pink-100" },
      { id: "kitchen", name: "🎁 부모님 & 명절 선물 세트", color: "bg-yellow-100" }
    ];
  }
  return CATEGORIES;
};

const SITES = [
  { id: '1688', name: '일육팔팔.com', title: '일육팔팔' },
  { id: 'vitamin', name: '비타민.kr', title: '비타민' },
  { id: 'ali', name: '알리.com', title: '알리' }
];

const getSiteId = () => {
  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);
  const siteParam = urlParams.get('site');
  
  // Environment variable has priority for independent deployments (e.g. Netlify)
  const envSiteId = import.meta.env.VITE_SITE_ID;
  
  let detectedId = '1688'; // Default

  if (envSiteId && ['1688', 'vitamin', 'ali'].includes(envSiteId)) {
    detectedId = envSiteId;
  } else if (siteParam === 'vitamin' || siteParam === '1688' || siteParam === 'ali') {
    detectedId = siteParam;
  } else if (hostname.includes('ali') || hostname.includes('알리') || hostname.includes('aliexpress') || hostname.includes('xn--om2b25i')) {
    detectedId = 'ali';
  } else if (hostname.includes('vitamin') || hostname.includes('비타민') || hostname.includes('xn--v42b10i')) {
    detectedId = 'vitamin';
  } else if (hostname.includes('1688') || hostname.includes('일육팔팔') || hostname.includes('xn--3r5bng313aa')) {
    detectedId = '1688';
  }

  // Enhanced debugging log for user
  console.log(
    `%c[Site Detection]%c Env ID: %c${envSiteId || 'undefined'}%c, Final ID: %c${detectedId}`,
    'background: #ff5722; color: #fff; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
    'color: #888;',
    'color: #222; font-weight: bold;',
    'color: #888;',
    'color: #ff5722; font-weight: bold; font-size: 14px;'
  );
  
  return detectedId;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const LandingPage = () => {
  const location = useLocation();
  const [config, setConfig] = useState<LandingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const siteId = getSiteId();
  const siteName = SITES.find(s => s.id === siteId)?.name;
  const categories = getCategories(siteId);
  const isAli = siteId === 'ali';
  const accentColor = getAccentColor(siteId);

  useEffect(() => {
    const siteId = getSiteId();
    // Use old paths for 1688 to restore data, new paths for others for isolation
    const docRef = siteId === '1688' 
      ? doc(db, 'config', 'landing') 
      : doc(db, 'config', `landing_${siteId}`);

    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LandingConfig;
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          siteId: siteId,
          blogs: data.blogs || [],
          youtubes: data.youtubes || [],
          youtubeAspectRatios: data.youtubeAspectRatios || [],
          youtubeComments: data.youtubeComments || [],
          products: data.products || []
        });
        setLoading(false);
      } else if (siteId === 'vitamin') {
        // Fallback to 1688 data for Vitamin site
        getDoc(doc(db, 'config', 'landing')).then(fallbackSnap => {
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data() as LandingConfig;
            setConfig({
              ...DEFAULT_CONFIG,
              ...data,
              siteId: siteId,
              blogs: data.blogs || [],
              youtubes: data.youtubes || [],
              youtubeAspectRatios: data.youtubeAspectRatios || [],
              youtubeComments: data.youtubeComments || [],
              products: data.products || []
            });
          } else {
            setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
          }
          setLoading(false);
        }).catch(() => {
          setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
          setLoading(false);
        });
      } else {
        setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, docRef.path);
    });
    return () => unsub();
  }, [siteId]);

  const toggleMenu = () => {
    const moreMenu = document.getElementById("moreMenu");
    moreMenu?.classList.toggle("hidden");
    moreMenu?.classList.toggle("grid");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#ff5722] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#f5f6f8] text-center font-sans pb-20"
    >
      <SEO 
        title={isAli ? (config.seoTitle || ALI_DEFAULT_SEO_TITLE) : (config.seoTitle || config.mainTitle || siteName)} 
        description={isAli ? (config.seoDescription || ALI_DEFAULT_SEO_DESC) : (config.seoDescription || config.mainContent?.substring(0, 160))} 
        keywords={config.seoKeywords}
        siteName={siteName}
      />
      <ScrollToTop />
      
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-0">
        {/* Branding Header at the very top */}
        <h1 className="text-3xl font-black mb-2 flex items-center justify-center gap-2">
          {isAli ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-[#FF4747] rounded-2xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden group mb-1 border-4 border-[#FF4747]">
                <div className="w-8 h-4 border-2 border-white border-t-0 rounded-b-full mb-1"></div>
                <div className="text-white text-[10px] font-black italic tracking-tighter">ALi.com</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black text-[#FF4747]">알리</span>
                <span className="text-gray-400 text-lg">.com</span>
              </div>
            </div>
          ) : (
            <>
              <span className="text-white px-3 py-1 rounded-xl text-lg font-black italic" style={{ backgroundColor: accentColor }}>
                {siteId === 'vitamin' ? '비타민.kr' : '1688'}
              </span>
              {siteId === 'vitamin' ? '비타민케이알' : '일육팔팔'}
            </>
          )}
        </h1>
        <p className="text-gray-500 font-bold mb-4">
          {isAli ? '알리익스프레스 가성비 해외직구 핫딜 추천' : (siteId === 'vitamin' ? '만성피로 해결, 가성비 종합비타민 추천 전문' : '같은 제품, 더 싸게 찾는 방법')}
        </p>
        
        <div className="text-xs text-gray-400 mb-6 break-keep">
          ⭐ 즐겨찾기(북마크)를 해두면 최저가 타이밍을 놓치지 않습니다
        </div>

        <SearchBar siteId={siteId} />
        <p className="text-[11px] text-gray-400 mt-[-16px] mb-4 text-center">
          {isAli ? '※ 본 사이트는 알리익스프레스 정보를 포함하고 있습니다.' : '※ 이 게시물은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-2">
        {/* Categories Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2">
          {categories.map((cat, i) => (
            <Link key={i} to={`/category/${cat.id}${siteId === 'vitamin' ? '?site=vitamin' : ''}`} className={`${cat.color} p-4 sm:p-6 rounded-2xl font-bold shadow-sm hover:-translate-y-1 transition-transform flex items-center justify-center text-center break-keep leading-tight`}>
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Hot Product Section */}
        <div className="mt-12">
          {/* 1. 제목 */}
          <h2 className="text-xl font-bold mb-6 flex items-center justify-center gap-2">
            {config.mainTitle || '🔥 지금 가장 많이 찾는 상품'}
          </h2>

          {/* 2. 상품 이미지 */}
          {config.mainImageUrl && (
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-8 overflow-hidden">
              <img 
                src={config.mainImageUrl} 
                alt={config.mainImageAlt || config.mainTitle || "Main Product"} 
                className="w-full h-auto rounded-xl object-cover max-h-[400px] border-none"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* 3. 내용 (Content) */}
          {config.mainContent && (
            <div className="markdown-body prose prose-slate max-w-none break-words mb-10 text-left px-2">
              <Markdown remarkPlugins={[remarkGfm]}>{config.mainContent}</Markdown>
            </div>
          )}

          {/* 4, 5, 6. 쇼츠 + 코멘트 + CTA (한 세트로 묶음) */}
          {(config.mainYoutubeId || config.mainComment || config.ctaText) && (
            <div className="space-y-4 mb-12 bg-gray-50/50 p-6 rounded-2xl shadow-sm">
              {/* 4. 쇼츠 (YouTube Shorts) */}
              {config.mainYoutubeId && (
                <div className={`w-full mx-auto rounded-2xl overflow-hidden shadow-lg mb-2 ${config.mainAspectRatio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                  <iframe 
                    src={`https://www.youtube.com/embed/${config.mainYoutubeId}`} 
                    className="w-full h-full border-none"
                    allowFullScreen
                    title="YouTube Shorts"
                  ></iframe>
                </div>
              )}

              {/* 5. 코멘트 (Comment) */}
              {config.mainComment && (
                <div className="bg-white/80 p-4 rounded-xl italic text-blue-800 text-sm break-keep text-center shadow-sm">
                  "{config.mainComment}"
                </div>
              )}

              {/* 6. CTA (Button) */}
              {config.ctaText && (
                <div className="flex justify-center pt-2">
                  <a href={ensureAbsoluteUrl(config.priceLink)} target="_blank" rel="noopener noreferrer" className="inline-block overflow-hidden rounded-xl transition-transform hover:scale-105">
                    {config.ctaImageUrl ? (
                      <div className="shadow-lg">
                        <img src={config.ctaImageUrl} alt={config.ctaText} className="w-full h-auto max-w-[300px]" referrerPolicy="no-referrer" />
                        <div className="text-white py-3 px-6 font-bold text-lg" style={{ backgroundColor: accentColor }}>
                          👉 {config.ctaText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-white px-8 py-4 font-bold text-lg shadow-lg" style={{ backgroundColor: accentColor }}>
                        👉 {config.ctaText}
                      </div>
                    )}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Blog Grid */}
          <div className="mt-4 font-bold mb-6" style={{ color: accentColor }}>
            놓치기 아까운 상품 다시보기
          </div>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {config.blogs.map((blog, i) => {
              const isExternal = blog.type === 'external';
              const target = isExternal ? ensureAbsoluteUrl(blog.link || '') : `/post/landing/${blog.id}${siteId === 'vitamin' ? '?site=vitamin' : ''}`;
              const className = "bg-white p-4 rounded-xl text-sm text-gray-700 shadow-sm hover:-translate-y-1 transition-transform text-center block truncate border-none outline-none";
              
              if (isExternal) {
                return (
                  <a 
                    key={i} 
                    href={target || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {blog.title}
                  </a>
                );
              }

              return (
                <Link 
                  key={i} 
                  to={target || '#'} 
                  className={className}
                >
                  {blog.title}
                </Link>
              );
            })}
          </div>

          {/* Product List Section (New) */}
          {config.products && config.products.length > 0 && (
            <div className="mt-12 space-y-6">
              {config.products.map((product, i) => (
                <div key={i}>
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    className="space-y-6"
                  >
                    {/* 1. 제목 */}
                    <h2 className="text-lg font-black text-gray-900 leading-snug break-keep mb-4">
                      {product.title}
                    </h2>

                    {/* 2. 상품 이미지 */}
                    {product.imageUrl && (
                      <div className="overflow-hidden rounded-2xl shadow-sm">
                        {product.link ? (
                          <a href={ensureAbsoluteUrl(product.link)} target="_blank" rel="noopener noreferrer" className="block">
                            <img 
                              src={product.imageUrl} 
                              alt={product.imageAlt || product.title} 
                              className="w-full h-auto object-cover max-h-[600px] border-none hover:scale-[1.02] transition-transform"
                              referrerPolicy="no-referrer"
                            />
                          </a>
                        ) : (
                          <img 
                            src={product.imageUrl} 
                            alt={product.imageAlt || product.title} 
                            className="w-full h-auto object-cover max-h-[600px] border-none"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}

                    {/* 3. 내용 */}
                    {product.content && (
                      <div className="markdown-body text-gray-700 leading-relaxed text-lg mt-8">
                        <Markdown remarkPlugins={[remarkGfm]}>{product.content}</Markdown>
                      </div>
                    )}

                    {/* 4, 5, 6. 쇼츠 + 코멘트 + CTA (한 세트로 묶음) */}
                    <div className="space-y-2 bg-gray-50/50 p-4 rounded-2xl shadow-sm">
                      {/* 4. 쇼츠 (YouTube Shorts) */}
                      {product.youtubeId && (
                        <div className={`w-full mx-auto rounded-2xl overflow-hidden shadow-lg mb-2 ${product.aspectRatio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                          <iframe 
                            src={`https://www.youtube.com/embed/${product.youtubeId}`}
                            title="YouTube Shorts"
                            className="w-full h-full border-none"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {/* 5. 코멘트 */}
                      {product.comment && (
                        <div className="bg-white/80 p-4 rounded-xl italic text-blue-800 text-sm break-keep text-center shadow-sm">
                          "{product.comment}"
                        </div>
                      )}

                      {/* 6. CTA 버튼 */}
                      {product.buttonText && (
                        <div className="flex justify-center pt-2">
                          <a 
                            href={ensureAbsoluteUrl(product.link || '')} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                            style={{ backgroundColor: accentColor }}
                          >
                            👉 {product.buttonText}
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.div>
                  <div className="mt-6 h-px bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Bottom YouTube & Comments Section (New) */}
          {((config.youtubes && config.youtubes.some(id => id)) || (config.youtubeComments && config.youtubeComments.some(c => c))) && (
            <div className="mt-16 space-y-12">
              {config.youtubes && config.youtubes.some(id => id) && (
                <div className="flex flex-wrap justify-center gap-6">
                  {config.youtubes.map((id, i) => {
                    if (!id) return null;
                    const ratio = (config.youtubeAspectRatios && config.youtubeAspectRatios[i]) || '9:16';
                    const isOnlyOne = config.youtubes.filter(v => v).length === 1;
                    return (
                      <div key={i} className={`${isOnlyOne ? 'w-full' : 'w-full md:w-[calc(50%-12px)]'} mx-auto rounded-2xl overflow-hidden shadow-lg ${ratio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                        <iframe 
                          src={`https://www.youtube.com/embed/${id}`}
                          title={`YouTube video ${i}`}
                          className="w-full h-full border-none"
                          allowFullScreen
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {config.youtubeComments && config.youtubeComments.some(c => c) && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                    <MessageCircle className="text-blue-600" /> 실시간 코멘트
                  </h2>
                  <div className="space-y-4">
                    {config.youtubeComments.map((comment, i) => {
                      if (!comment) return null;
                      return (
                        <motion.div 
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          whileInView={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <UserIcon size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-gray-900 mb-1">익명 사용자</div>
                            <div className="text-gray-700 text-sm break-keep">{comment}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-block mt-12 px-8 py-3 text-white rounded-full font-bold shadow-md hover:scale-105 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            🏠 홈으로 가기
          </button>

          {siteId !== 'ali' && (
            <div className="mt-8 mb-4 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white opacity-90 transition-opacity">
              <iframe 
                src="https://coupa.ng/cmvRhO" 
                width="100%" 
                height="75" 
                frameBorder="0" 
                scrolling="no" 
                referrerPolicy="unsafe-url"
                title="Coupang Search Widget"
              ></iframe>
            </div>
          )}

          <div className="text-[14px] text-gray-400 mt-6 leading-relaxed whitespace-pre-wrap text-center">
            {config.footerNotice || (siteId === 'ali' ? '※ 본 사이트는 가성비 해외직구 상품을 소개합니다.' : '※ 이 게시물은 쿠팡 파트너스 활동의 일환으로\n일정액의 수수료를 제공받습니다.')}
          </div>
        </div>
      </div>
      
      {/* Admin Link (Floating) */}
      <Link to="/admin" className="fixed bottom-5 right-5 bg-gray-800 text-white p-3 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity">
        <Settings size={20} />
      </Link>
    </motion.div>
  );
};

const CategoryPage = () => {
  const location = useLocation();
  const { categoryId } = useParams();
  const [config, setConfig] = useState<LandingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const siteId = getSiteId();
  const siteName = SITES.find(s => s.id === siteId)?.name;
  const categories = getCategories(siteId);
  const isAli = siteId === 'ali';
  const accentColor = getAccentColor(siteId);
  const category = categories.find(c => c.id === categoryId);

  useEffect(() => {
    if (!categoryId) return;
    const siteId = getSiteId();
    // Use old paths for 1688 to restore data, new paths for others for isolation
    // siteId === '1688' || siteId === 'vitamin' 조건으로 데이터 통합
    const docRef = (siteId === '1688' || siteId === 'vitamin')
      ? doc(db, 'categories', categoryId)
      : doc(db, 'categories', `${siteId}_${categoryId}`);

    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LandingConfig;
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          siteId: siteId,
          blogs: data.blogs || [],
          youtubes: data.youtubes || [],
          youtubeAspectRatios: data.youtubeAspectRatios || [],
          youtubeComments: data.youtubeComments || [],
          products: data.products || []
        });
        setLoading(false);
      } else if (siteId === 'vitamin') {
        // Fallback to 1688 data for Vitamin site
        getDoc(doc(db, 'categories', categoryId)).then(fallbackSnap => {
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data() as LandingConfig;
            setConfig({
              ...DEFAULT_CONFIG,
              ...data,
              siteId: siteId,
              blogs: data.blogs || [],
              youtubes: data.youtubes || [],
              youtubeAspectRatios: data.youtubeAspectRatios || [],
              youtubeComments: data.youtubeComments || [],
              products: data.products || []
            });
          } else {
            setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
          }
          setLoading(false);
        }).catch(() => {
          setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
          setLoading(false);
        });
      } else {
        setConfig({ ...DEFAULT_CONFIG, siteId: siteId });
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, docRef.path);
    });
    return () => unsub();
  }, [categoryId, siteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#ff5722] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auto-recovery for non-existent category
  if (!category || (!config.mainTitle && config.blogs.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5 text-center">
        <SEO title="카테고리를 찾을 수 없습니다" siteName={siteName} />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100"
        >
          <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={40} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-4 break-keep">
            해당 카테고리 정보를<br />찾을 수 없습니다
          </h1>
          <p className="text-sm text-gray-500 mb-8 break-keep leading-relaxed">
            주소가 변경되었거나 아직 준비 중인 페이지입니다.<br />
            잠시 후 메인 페이지로 이동합니다.
          </p>
          <Link 
            to={siteId === 'vitamin' ? '/?site=vitamin' : '/'}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
          >
            메인 페이지로 이동
          </Link>
        </motion.div>
        <script>
          {`setTimeout(() => { window.location.href = "${siteId === 'vitamin' ? '/?site=vitamin' : '/'}"; }, 5000);`}
        </script>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#f5f6f8] text-center font-sans pb-20"
    >
      <SEO 
        title={config.seoTitle || config.mainTitle || category?.name} 
        description={config.seoDescription || config.mainContent?.substring(0, 160)} 
        keywords={config.seoKeywords}
        siteName={siteName}
      />
      <ScrollToTop />
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-0">
        <SearchBar siteId={siteId} />
      </div>
      <div className="max-w-2xl mx-auto px-5 pt-2 pb-10">
        <div className="relative mb-3 flex items-center min-h-[40px]">
          <Link to={siteId === '1688' ? '/' : (siteId === 'vitamin' ? '/?site=vitamin' : '/?site=ali')} className="absolute left-0 inline-flex items-center text-gray-500 hover:text-black z-10 text-sm">
            <ChevronRight className="rotate-180 mr-1" size={16} /> 홈으로
          </Link>
          <h1 className="text-[21px] font-bold w-full text-center px-12 leading-tight">{category?.name || '카테고리'}</h1>
        </div>

        {/* Content Section */}
        <div className="mt-1">
          {/* 1. 제목 */}
          <h2 className="text-lg font-bold mb-2 flex items-center justify-center gap-2">
            {config.mainTitle || category?.name || '카테고리'}
          </h2>

          {/* 2. 상품 이미지 */}
          {config.mainImageUrl && (
            <div className="bg-white p-2 rounded-2xl shadow-sm mb-3 overflow-hidden">
              <img 
                src={config.mainImageUrl} 
                alt={config.mainImageAlt || config.mainTitle || category?.name} 
                className="w-full h-auto rounded-xl object-cover max-h-[320px] border-none"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* 3. 내용 (Content) */}
          {config.mainContent && (
            <div className="markdown-body prose prose-slate max-w-none break-words mb-0.5 text-left px-1 text-[15px]">
              <Markdown remarkPlugins={[remarkGfm]}>{config.mainContent}</Markdown>
            </div>
          )}

          {/* 4, 5, 6. 쇼츠 + 코멘트 + CTA (한 세트로 묶음) */}
          {(config.mainYoutubeId || config.mainComment || config.ctaText) && (
            <div className="space-y-3 mb-6 bg-gray-50/50 p-3 rounded-2xl shadow-sm border border-gray-100">
              {/* 4. 쇼츠 (YouTube Shorts) */}
              {config.mainYoutubeId && (
                <div className={`w-full mx-auto rounded-2xl overflow-hidden shadow-sm mb-1 ${config.mainAspectRatio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[280px]'}`}>
                  <iframe 
                    src={`https://www.youtube.com/embed/${config.mainYoutubeId}`} 
                    className="w-full h-full border-none"
                    allowFullScreen
                    title="YouTube Shorts"
                  ></iframe>
                </div>
              )}

              {/* 5. 코멘트 (Comment) */}
              {config.mainComment && (
                <div className="bg-white/90 p-3 rounded-xl italic text-blue-800 text-[13px] break-keep text-center shadow-sm">
                  "{config.mainComment}"
                </div>
              )}

              {/* 6. CTA (Button) */}
              {config.ctaText && (
                <div className="flex justify-center pt-0">
                  <a href={ensureAbsoluteUrl(config.priceLink)} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-block overflow-hidden rounded-xl transition-transform hover:scale-105">
                    {config.ctaImageUrl ? (
                      <div className="shadow-md">
                        <img src={config.ctaImageUrl} alt={config.ctaText} className="w-full h-auto max-w-full sm:max-w-[300px]" referrerPolicy="no-referrer" />
                        <div className="text-white py-2.5 px-4 font-bold text-base" style={{ backgroundColor: accentColor }}>
                          👉 {config.ctaText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-white px-5 py-3 font-bold text-[15px] shadow-md text-center" style={{ backgroundColor: accentColor }}>
                        👉 {config.ctaText}
                      </div>
                    )}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Blog Grid */}
          <div className="mt-4 font-bold mb-6" style={{ color: accentColor }}>
            놓치기 아까운 상품 다시보기
          </div>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {config.blogs.map((blog, i) => {
              const isExternal = blog.type === 'external';
              const target = isExternal ? ensureAbsoluteUrl(blog.link || '') : `/post/${categoryId}/${blog.id}${siteId === 'vitamin' ? '?site=vitamin' : ''}`;
              const className = "bg-white p-4 rounded-xl text-sm text-gray-700 shadow-sm hover:-translate-y-1 transition-transform text-center block truncate border-none outline-none";
              
              if (isExternal) {
                return (
                  <a 
                    key={i} 
                    href={target || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {blog.title}
                  </a>
                );
              }

              return (
                <Link 
                  key={i} 
                  to={target || '#'} 
                  className={className}
                >
                  {blog.title}
                </Link>
              );
            })}
          </div>

          {/* Product List Section (New) */}
          {config.products && config.products.length > 0 && (
            <div className="mt-12 space-y-6">
              {config.products.map((product, i) => (
                <div key={i}>
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    className="space-y-6"
                  >
                    {/* 1. 제목 */}
                    <h2 className="text-lg font-black text-gray-900 leading-snug break-keep mb-4">
                      {product.title}
                    </h2>

                    {/* 2. 상품 이미지 */}
                    {product.imageUrl && (
                      <div className="overflow-hidden rounded-2xl shadow-sm">
                        {product.link ? (
                          <a href={ensureAbsoluteUrl(product.link)} target="_blank" rel="noopener noreferrer" className="block">
                            <img 
                              src={product.imageUrl} 
                              alt={product.imageAlt || product.title} 
                              className="w-full h-auto object-cover max-h-[600px] border-none hover:scale-[1.02] transition-transform"
                              referrerPolicy="no-referrer"
                            />
                          </a>
                        ) : (
                          <img 
                            src={product.imageUrl} 
                            alt={product.imageAlt || product.title} 
                            className="w-full h-auto object-cover max-h-[600px] border-none"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}

                    {/* 3. 내용 */}
                    {product.content && (
                      <div className="markdown-body text-gray-700 leading-relaxed text-lg mt-8">
                        <Markdown remarkPlugins={[remarkGfm]}>{product.content}</Markdown>
                      </div>
                    )}

                    {/* 4, 5, 6. 쇼츠 + 코멘트 + CTA (한 세트로 묶음) */}
                    <div className="space-y-2 bg-gray-50/50 p-4 rounded-2xl shadow-sm">
                      {/* 4. 쇼츠 (YouTube Shorts) */}
                      {product.youtubeId && (
                        <div className={`w-full mx-auto rounded-2xl overflow-hidden shadow-lg mb-2 ${product.aspectRatio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                          <iframe 
                            src={`https://www.youtube.com/embed/${product.youtubeId}`}
                            title="YouTube Shorts"
                            className="w-full h-full border-none"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {/* 5. 코멘트 */}
                      {product.comment && (
                        <div className="bg-white/80 p-4 rounded-xl italic text-blue-800 text-sm break-keep text-center shadow-sm">
                          "{product.comment}"
                        </div>
                      )}

                      {/* 6. CTA 버튼 */}
                      <div className="pt-2">
                        <a 
                          href={ensureAbsoluteUrl(product.link)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                          style={{ backgroundColor: accentColor }}
                        >
                          👉 {product.buttonText || '가격 확인하기'}
                        </a>
                      </div>
                    </div>
                    
                    {/* 상품 간 구분선 */}
                    <div className="pt-2 pb-1">
                      <div className="h-px bg-gray-100" />
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom YouTube & Comments Section (New) */}
          {((config.youtubes && config.youtubes.some(id => id)) || (config.youtubeComments && config.youtubeComments.some(c => c))) && (
            <div className="mt-16 space-y-12">
              {config.youtubes && config.youtubes.some(id => id) && (
                <div className="flex flex-wrap justify-center gap-6">
                  {config.youtubes.map((id, i) => {
                    if (!id) return null;
                    const ratio = (config.youtubeAspectRatios && config.youtubeAspectRatios[i]) || '9:16';
                    const isOnlyOne = config.youtubes.filter(v => v).length === 1;
                    return (
                      <div key={i} className={`${isOnlyOne ? 'w-full' : 'w-full md:w-[calc(50%-12px)]'} mx-auto rounded-2xl overflow-hidden shadow-lg ${ratio === '16:9' ? 'aspect-video max-w-full' : 'aspect-[9/16] max-w-[300px]'}`}>
                        <iframe 
                          src={`https://www.youtube.com/embed/${id}`}
                          title={`YouTube video ${i}`}
                          className="w-full h-full border-none"
                          allowFullScreen
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {config.youtubeComments && config.youtubeComments.some(c => c) && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                    <MessageCircle className="text-blue-600" /> 실시간 코멘트
                  </h2>
                  <div className="space-y-4">
                    {config.youtubeComments.map((comment, i) => {
                      if (!comment) return null;
                      return (
                        <motion.div 
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          whileInView={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl text-left"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <UserIcon size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-gray-900 mb-1">익명 사용자</div>
                            <div className="text-gray-700 text-sm break-keep">{comment}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 font-bold" style={{ color: accentColor }}>
            놓치기 아까운 상품 다시보기
          </div>

          <Link 
            to={siteId === '1688' ? '/' : (siteId === 'vitamin' ? '/?site=vitamin' : '/?site=ali')}
            className="inline-block mt-4 px-8 py-3 text-white rounded-full font-bold shadow-md hover:scale-105 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            🏠 홈으로 가기
          </Link>

          <div className="text-[14px] text-gray-400 mt-10 leading-relaxed whitespace-pre-wrap text-center">
            {config.footerNotice || '※ 이 게시물은 쿠팡 파트너스 활동의 일환으로\n일정액의 수수료를 제공받습니다.'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState(getSiteId());
  const categories = getCategories(selectedSite);
  const [selectedTarget, setSelectedTarget] = useState<'landing' | string>('landing');
  const [config, setConfig] = useState<LandingConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set a timeout for loading state to prevent being stuck
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      setUser(u);
      setLoading(false);
      if (u && u.email?.toLowerCase() !== 'woom2211@gmail.com') {
        setAuthError(`관리자 권한이 없습니다. (${u.email} 계정으로 로그인됨. woom2211@gmail.com 계정으로 로그인하세요)`);
        signOut(auth);
      } else {
        setAuthError(null);
      }
    });
    return () => {
      unsubAuth();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setFetchError(null);
    setLoading(true);
    
    // Use old paths for 1688 to restore data, new paths for others for isolation
    const docRef = selectedSite === '1688'
      ? (selectedTarget === 'landing' ? doc(db, 'config', 'landing') : doc(db, 'categories', selectedTarget))
      : (selectedTarget === 'landing' ? doc(db, 'config', `landing_${selectedSite}`) : doc(db, 'categories', `${selectedSite}_${selectedTarget}`));

    const fetchConfig = async () => {
      try {
        let snapshot = await getDoc(docRef);
        
        // Fallback to 1688 data if Vitamin data doesn't exist yet
        if (!snapshot.exists() && selectedSite === 'vitamin') {
          const fallbackRef = selectedTarget === 'landing' 
            ? doc(db, 'config', 'landing') 
            : doc(db, 'categories', selectedTarget);
          snapshot = await getDoc(fallbackRef);
        }

        if (snapshot.exists()) {
          const data = snapshot.data() as LandingConfig;
          setConfig({
            ...DEFAULT_CONFIG,
            ...data,
            siteId: selectedSite,
            blogs: data.blogs || [],
            youtubes: data.youtubes || [],
            youtubeAspectRatios: data.youtubeAspectRatios || [],
            youtubeComments: data.youtubeComments || [],
            products: data.products || []
          });
        } else {
          setConfig({ ...DEFAULT_CONFIG, siteId: selectedSite });
        }
      } catch (error: any) {
        console.error("Admin config fetch error:", error);
        setFetchError(error.message);
        handleFirestoreError(error, OperationType.GET, docRef.path);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [user, selectedTarget, selectedSite]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용하거나, 새 탭에서 앱을 열어주세요.');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        setAuthError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else {
        setAuthError('로그인 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Use old paths for 1688 to restore data, new paths for others for isolation
      const docRef = selectedSite === '1688'
        ? (selectedTarget === 'landing' ? doc(db, 'config', 'landing') : doc(db, 'categories', selectedTarget))
        : (selectedTarget === 'landing' ? doc(db, 'config', `landing_${selectedSite}`) : doc(db, 'categories', `${selectedSite}_${selectedTarget}`));

      // Explicitly clean the object to remove undefined properties
      const cleanData = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(cleanData);
        
        // Don't clean Firestore special objects (like Timestamps or FieldValues)
        if (typeof obj.toDate === 'function' || obj._methodName) {
          return obj;
        }

        const result: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) {
            result[key] = cleanData(obj[key]);
          }
        });
        return result;
      };

      // Only save allowed fields to prevent extra data from causing permission errors
      const allowedKeys = ['siteId', 'mainTitle', 'mainImageUrl', 'mainImageAlt', 'mainContent', 'mainYoutubeId', 'mainComment', 'mainAspectRatio', 'priceLink', 'ctaText', 'ctaImageUrl', 'footerNotice', 'blogs', 'youtubes', 'youtubeAspectRatios', 'youtubeComments', 'products', 'name', 'id', 'seoTitle', 'seoDescription', 'seoKeywords'];
      const filteredConfig: any = {};
      allowedKeys.forEach(key => {
        if ((config as any)[key] !== undefined) {
          filteredConfig[key] = (config as any)[key];
        }
      });

      // Ensure nested objects are also cleaned
      if (filteredConfig.blogs) {
        filteredConfig.blogs = filteredConfig.blogs.map((b: any) => cleanData(b));
      }
      if (filteredConfig.products) {
        filteredConfig.products = filteredConfig.products.map((p: any) => cleanData(p));
      }

      const dataToSave = {
        ...filteredConfig,
        updatedAt: serverTimestamp()
      };

      // Ensure arrays are always arrays
      if (!dataToSave.blogs) dataToSave.blogs = [];
      if (!dataToSave.youtubes) dataToSave.youtubes = [];
      if (!dataToSave.youtubeAspectRatios) dataToSave.youtubeAspectRatios = [];
      if (!dataToSave.youtubeComments) dataToSave.youtubeComments = [];
      if (!dataToSave.products) dataToSave.products = [];

      console.log('Attempting to save config to:', docRef.path, dataToSave);

      await setDoc(docRef, dataToSave);
      setToast({ message: '저장되었습니다!', type: 'success' });
    } catch (error) {
      console.error('Save error details:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setToast({ message: `저장 중 오류가 발생했습니다: ${errorMessage}`, type: 'error' });
      handleFirestoreError(error, OperationType.WRITE, selectedTarget === 'landing' ? `config/landing_${selectedSite}` : `categories/${selectedSite}_${selectedTarget}`);
    } finally {
      setSaving(false);
    }
  };

  const updateBlog = (index: number, field: keyof Blog, value: any) => {
    setConfig(prev => {
      const newBlogs = [...prev.blogs];
      newBlogs[index] = { ...newBlogs[index], [field]: value };
      return { ...prev, blogs: newBlogs };
    });
  };

  const updateYoutube = (index: number, value: string) => {
    setConfig(prev => {
      const newYoutubes = [...prev.youtubes];
      newYoutubes[index] = value;
      return { ...prev, youtubes: newYoutubes };
    });
  };

  const updateYoutubeAspectRatio = (index: number, value: string) => {
    setConfig(prev => {
      const newAspectRatios = [...(prev.youtubeAspectRatios || [])];
      while (newAspectRatios.length <= index) {
        newAspectRatios.push('9:16');
      }
      newAspectRatios[index] = value;
      return { ...prev, youtubeAspectRatios: newAspectRatios };
    });
  };

  const updateYoutubeComment = (index: number, value: string) => {
    setConfig(prev => {
      const newComments = [...(prev.youtubeComments || [])];
      newComments[index] = value;
      return { ...prev, youtubeComments: newComments };
    });
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    setConfig(prev => {
      const newProducts = [...(prev.products || [])];
      if (!newProducts[index]) {
        newProducts[index] = { id: Date.now().toString(), imageUrl: '', title: '', link: '', buttonText: '', content: '', youtubeId: '', comment: '' };
      }
      newProducts[index] = { ...newProducts[index], [field]: value };
      return { ...prev, products: newProducts };
    });
  };

  const addProduct = () => {
    const newProduct: Product = {
      id: Date.now().toString(),
      imageUrl: '',
      title: '',
      link: '',
      buttonText: '가격 확인하기',
      aspectRatio: '9:16'
    };
    setConfig(prev => ({ ...prev, products: [...(prev.products || []), newProduct] }));
  };

  const deleteProduct = (index: number) => {
    setConfig(prev => {
      const newProducts = (prev.products || []).filter((_, i) => i !== index);
      return { ...prev, products: newProducts };
    });
  };

  const addBlog = () => {
    const newBlog: Blog = {
      id: Date.now().toString(),
      title: '새 블로그 포스트',
      type: 'external',
      link: '',
      content: '',
      youtubeId: '',
      comment: '',
      aspectRatio: '9:16'
    };
    setConfig(prev => ({ ...prev, blogs: [...prev.blogs, newBlog] }));
  };

  const deleteBlog = (index: number) => {
    setConfig(prev => {
      const newBlogs = prev.blogs.filter((_, i) => i !== index);
      return { ...prev, blogs: newBlogs };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-5">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">관리자 권한 확인 중...</p>
        <Link to="/" className="mt-8 text-sm text-gray-400 hover:underline">홈으로 돌아가기</Link>
      </div>
    );
  }

  if (!user || user.email?.toLowerCase() !== 'woom2211@gmail.com') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-5">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-2">관리자 로그인</h1>
          <p className="text-gray-500 mb-6 text-sm">지정된 관리자 계정으로 로그인하세요.</p>
          
          {authError && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 break-keep">
              {authError}
            </div>
          )}

          <button 
            onClick={handleLogin} 
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google로 로그인
          </button>
          
          <div className="mt-8 pt-6 border-t">
            <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">데이터 로드 오류</h1>
          <p className="text-gray-600 mb-6">{fetchError}</p>
          <p className="text-sm text-gray-400 mb-6">권한이 없거나 네트워크 문제일 수 있습니다.</p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              다시 시도
            </button>
            <button onClick={() => signOut(auth)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-10">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-10 left-1/2 px-8 py-4 rounded-2xl shadow-2xl z-[9999] font-bold text-lg flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
          >
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-md py-6 mb-10 border-b border-gray-200 -mx-5 md:-mx-10 px-5 md:px-10 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-4 text-gray-900 tracking-tighter">
            <Settings className="text-blue-600 w-8 h-8" />
            "{SITES.find(s => s.id === selectedSite)?.title}" 관리자 패널
          </h1>
          <div className="flex items-center gap-6">
            <Link to={selectedSite === 'vitamin' ? '/?site=vitamin' : '/'} className="text-gray-600 hover:text-blue-600 flex items-center gap-2 font-bold text-lg transition-colors">
              <Home size={24} /> 사이트 보기
            </Link>
            <button onClick={() => signOut(auth)} className="text-red-500 hover:text-red-700 flex items-center gap-2 font-bold text-lg transition-colors">
              <LogOut size={24} /> 로그아웃
            </button>
          </div>
        </div>

        {/* Site Selector */}
        <div className="bg-white p-8 rounded-2xl shadow-sm mb-8 border border-gray-100">
          <label className="block text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Globe size={32} className="text-blue-600" /> 1. 편집할 사이트 선택
          </label>
          <div className="flex gap-4">
            {SITES.map(site => (
              <button 
                key={site.id}
                onClick={() => setSelectedSite(site.id)}
                className={`flex-1 p-5 text-lg font-black rounded-[1.5rem] border-2 transition-all duration-300 ${selectedSite === site.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}`}
              >
                {site.name} ({site.title})
              </button>
            ))}
          </div>
        </div>

        {/* Target Selector */}
        <div className="bg-white p-8 rounded-2xl shadow-sm mb-8 border border-gray-100">
          <label className="block text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Plus size={32} className="text-blue-600" /> 2. 편집할 페이지 선택
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <button 
              onClick={() => setSelectedTarget('landing')}
              className={`p-5 text-lg font-black rounded-[1.5rem] border-2 transition-all duration-300 ${selectedTarget === 'landing' ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}`}
            >
              🏠 메인 인트로
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedTarget(cat.id)}
                className={`p-5 text-lg font-black rounded-[1.5rem] border-2 transition-all duration-300 ${selectedTarget === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' : 'bg-white text-gray-600 border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <p className="mt-6 text-base text-blue-600 font-bold italic flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            선택한 페이지의 모든 컨텐츠를 개별적으로 관리할 수 있습니다.
          </p>
        </div>

        {/* SEO Settings */}
        <div className="bg-white p-8 rounded-2xl shadow-sm mb-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Globe size={32} className="text-blue-600" /> SEO 최적화 설정
          </h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-700">SEO 제목 (Title Tag)</label>
                <span className={`text-xs font-bold ${(config.seoTitle || '').length > 40 ? 'text-red-500' : 'text-blue-600'}`}>
                  {(config.seoTitle || '').length} / 40자 (네이버 권장)
                </span>
              </div>
              <input 
                type="text" 
                value={config.seoTitle || ''} 
                onChange={(e) => setConfig({...config, seoTitle: e.target.value})}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${(config.seoTitle || '').length > 40 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                placeholder="검색 엔진에 표시될 제목 (40자 이내 권장)"
              />
              <p className="mt-1 text-[10px] text-gray-400">* 제목이 너무 길면 네이버 검색 결과에서 불이익을 받을 수 있습니다.</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-700">SEO 설명 (Meta Description)</label>
                <span className={`text-xs font-bold ${(config.seoDescription || '').length > 80 ? 'text-red-500' : 'text-blue-600'}`}>
                  {(config.seoDescription || '').length} / 80자 (네이버 권장)
                </span>
              </div>
              <textarea 
                value={config.seoDescription || ''} 
                onChange={(e) => setConfig({...config, seoDescription: e.target.value})}
                className={`w-full p-3 border rounded-lg h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${(config.seoDescription || '').length > 80 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                placeholder="검색 엔진에 표시될 설명 (80자 이내 권장)"
              />
              <p className="mt-1 text-[10px] text-gray-400">* 핵심 키워드를 포함하여 80자 이내로 요약하는 것이 가장 효과적입니다.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">SEO 키워드 (Keywords)</label>
              <input 
                type="text" 
                value={config.seoKeywords || ''} 
                onChange={(e) => setConfig({...config, seoKeywords: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="키워드1, 키워드2, 키워드3 (쉼표로 구분)"
              />
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {/* Main Image & Price Link */}
          <div className="bg-white p-8 rounded-2xl shadow-sm space-y-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-red-600 mb-6 flex items-center gap-3">
              <ImageIcon size={32} className="text-red-600" /> {selectedTarget === 'landing' ? '메인 페이지' : `${categories.find(c => c.id === selectedTarget)?.name || '카테고리'}`} 상단 대표 섹션
            </h2>
            <div className="space-y-10">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목 (Title)</label>
                  <input 
                    type="text" 
                    value={config.mainTitle || ''} 
                    onChange={(e) => setConfig({...config, mainTitle: e.target.value})}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={selectedTarget === 'landing' ? '🔥 지금 가장 많이 찾는 상품' : '카테고리 제목'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이미지/GIF URL</label>
                  <input 
                    type="text" 
                    value={config.mainImageUrl} 
                    onChange={(e) => setConfig({...config, mainImageUrl: e.target.value})}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이미지 설명 (Alt 태그)-선택사항.</label>
                  <input 
                    type="text" 
                    value={config.mainImageAlt || ''} 
                    onChange={(e) => setConfig({...config, mainImageAlt: e.target.value})}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="이미지에 대한 설명 (SEO 키워드 포함)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-red-600 mb-1">본문 내용 (Markdown 지원)</label>
                <textarea 
                  value={config.mainContent || ''} 
                  onChange={(e) => setConfig({...config, mainContent: e.target.value})}
                  className="w-full p-3 border rounded-lg h-40 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="메인 섹션의 상세 설명을 작성하세요..."
                />
              </div>

              <div className="rounded-xl border border-purple-100 overflow-hidden shadow-sm">
                <div className="p-4 bg-purple-50 space-y-3">
                  <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                    <Video size={14} /> 쇼츠 및 코멘트 설정
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">유튜브 쇼츠 ID</label>
                      <input 
                        type="text" 
                        value={config.mainYoutubeId || ''} 
                        onChange={(e) => setConfig({...config, mainYoutubeId: e.target.value})}
                        className="w-full p-2 border rounded-md text-xs"
                        placeholder="ID만 입력 (예: dQw4w9WgXcQ)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">쇼츠 하단 코멘트</label>
                      <input 
                        type="text" 
                        value={config.mainComment || ''} 
                        onChange={(e) => setConfig({...config, mainComment: e.target.value})}
                        className="w-full p-2 border rounded-md text-xs"
                        placeholder="영상에 대한 코멘트"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">영상 비율</label>
                      <select 
                        value={config.mainAspectRatio || '9:16'} 
                        onChange={(e) => setConfig({...config, mainAspectRatio: e.target.value as '9:16' | '16:9'})}
                        className="w-full p-2 border rounded-md text-xs bg-white"
                      >
                        <option value="9:16">9:16 (세로/쇼츠)</option>
                        <option value="16:9">16:9 (가로/일반)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 border-t border-purple-100 space-y-3">
                  <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                    <LinkIcon size={14} /> 하단 CTA 버튼 설정
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">사이트 주소 입력.</label>
                      <input 
                        type="text" 
                        value={config.priceLink} 
                        onChange={(e) => setConfig({...config, priceLink: e.target.value})}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CTA 버튼 문구</label>
                      <input 
                        type="text" 
                        value={config.ctaText || ''} 
                        onChange={(e) => setConfig({...config, ctaText: e.target.value})}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="최저가 보러가기"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CTA 버튼 이미지 URL (이미지형 버튼 사용시)</label>
                      <input 
                        type="text" 
                        value={config.ctaImageUrl || ''} 
                        onChange={(e) => setConfig({...config, ctaImageUrl: e.target.value})}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                  <div className="font-bold text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <FileText size={14} /> 하단 공지/안내 문구 (쿠팡 파트너스 등)
                  </div>
                  <textarea 
                    value={config.footerNotice || ''} 
                    onChange={(e) => setConfig({...config, footerNotice: e.target.value})}
                    className="w-full p-3 border rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="※ 이 게시물은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Blog Links */}
          <div className="bg-white p-8 rounded-2xl shadow-sm space-y-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <LinkIcon size={32} className="text-blue-600" /> {selectedTarget === 'landing' ? '메인 페이지' : `${categories.find(c => c.id === selectedTarget)?.name || '카테고리'}`} 블로그 컨텐츠 관리 ({config.blogs.length}개)
              </h2>
              <button 
                onClick={addBlog}
                className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={18} /> 블로그 추가
              </button>
            </div>
            <div className="space-y-8">
              {config.blogs.map((blog, i) => (
                <div key={blog.id || i} className="p-6 border border-gray-100 rounded-xl space-y-4 relative group shadow-sm">
                    <button 
                      onClick={() => deleteBlog(i)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="flex items-center justify-between pr-8">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-red-600">블로그 {i + 1}</span>
                        {blog.type === 'internal' && (
                          <Link 
                            to={`/post/${selectedTarget}/${blog.id}`}
                            target="_blank"
                            className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-300 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={10} /> 미리보기
                          </Link>
                        )}
                      </div>
                      <div className="flex bg-white rounded-lg p-1 border">
                        <button 
                          onClick={() => updateBlog(i, 'type', 'external')}
                          className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 ${blog.type === 'external' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                        >
                          <Globe size={12} /> 외부 링크
                        </button>
                        <button 
                          onClick={() => updateBlog(i, 'type', 'internal')}
                          className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 ${blog.type === 'internal' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                        >
                          <FileText size={12} /> 직접 작성
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700 mb-1">제목 (Title)</label>
                      <textarea 
                        value={blog.title} 
                        onChange={(e) => updateBlog(i, 'title', e.target.value)}
                        className="w-full p-3 border rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                        rows={2}
                        placeholder="블로그 제목을 입력하세요"
                      />
                    </div>

                    {blog.type === 'external' ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">외부 링크 URL</label>
                        <input 
                          type="text" 
                          value={blog.link || ''} 
                          onChange={(e) => updateBlog(i, 'link', e.target.value)}
                          className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="https://blog.naver.com/..."
                        />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="font-bold text-base text-red-600 mb-3 flex items-center gap-2">
                            <Video size={16} /> 유튜브 영상 설정
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">유튜브 ID</label>
                              <input 
                                type="text" 
                                value={blog.youtubeId || ''} 
                                onChange={(e) => updateBlog(i, 'youtubeId', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="ID만 입력"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">영상 코멘트</label>
                              <input 
                                type="text" 
                                value={blog.comment || ''} 
                                onChange={(e) => updateBlog(i, 'comment', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="영상 코멘트"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">영상 비율</label>
                              <select 
                                value={blog.aspectRatio || '9:16'} 
                                onChange={(e) => updateBlog(i, 'aspectRatio', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                <option value="9:16">9:16 (세로/쇼츠)</option>
                                <option value="16:9">16:9 (가로/일반)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="font-bold text-base text-red-600 mb-3 flex items-center gap-2">
                            <ImageIcon size={16} /> 상품 이미지 설정
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">상품 이미지 URL</label>
                              <input 
                                type="text" 
                                value={blog.footerImageUrl || ''} 
                                onChange={(e) => updateBlog(i, 'footerImageUrl', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="https://..."
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">이미지 설명 (Alt 태그)-선택사항.</label>
                              <input 
                                type="text" 
                                value={blog.imageAlt || ''} 
                                onChange={(e) => updateBlog(i, 'imageAlt', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="이미지 설명"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500">이미지 클릭 링크-선택사항</label>
                              <input 
                                type="text" 
                                value={blog.footerImageLink || ''} 
                                onChange={(e) => updateBlog(i, 'footerImageLink', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-base font-bold text-red-600">본문 내용 (Markdown 지원)</label>
                          <textarea 
                            value={blog.content || ''} 
                            onChange={(e) => updateBlog(i, 'content', e.target.value)}
                            className="w-full p-3 border rounded-lg text-sm h-64 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="# 제목\n\n여기에 내용을 작성하세요..."
                          />
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="font-bold text-base text-red-600 mb-3 flex items-center gap-2">
                            <Globe size={16} /> 쿠팡 파트너스 배너 설정 (HTML 태그 추천)
                          </div>
                          <textarea 
                            value={blog.bannerCode || ''} 
                            onChange={(e) => updateBlog(i, 'bannerCode', e.target.value)}
                            className="w-full p-3 border rounded-lg text-xs h-24 font-mono focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            placeholder="쿠팡 파트너스에서 복사한 HTML 태그 소스를 여기에 붙여넣으세요."
                          />
                          <p className="mt-2 text-[10px] text-blue-400">
                            * 쿠팡 파트너스 배너 생성 시 'HTML 태그' 방식을 선택하여 복사한 소스를 그대로 붙여넣으시면 됩니다.
                          </p>
                        </div>

                        <div className="rounded-xl border border-purple-100 overflow-hidden shadow-sm">
                          <div className="p-4 bg-orange-50 space-y-3">
                            <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                              <LinkIcon size={14} /> 하단 CTA 버튼 설정
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">버튼 문구</label>
                                <input 
                                  type="text" 
                                  value={blog.ctaText || ''} 
                                  onChange={(e) => updateBlog(i, 'ctaText', e.target.value)}
                                  className="w-full p-2 border rounded-md text-xs"
                                  placeholder="최저가 제품 보러가기"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">사이트 주소 입력.</label>
                                <input 
                                  type="text" 
                                  value={blog.ctaLink || ''} 
                                  onChange={(e) => updateBlog(i, 'ctaLink', e.target.value)}
                                  className="w-full p-2 border rounded-md text-xs"
                                  placeholder="https://..."
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">버튼 이미지 URL (이미지형 버튼 사용시)</label>
                                <input 
                                  type="text" 
                                  value={blog.ctaImageUrl || ''} 
                                  onChange={(e) => updateBlog(i, 'ctaImageUrl', e.target.value)}
                                  className="w-full p-2 border rounded-md text-xs"
                                  placeholder="https://..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="h-px bg-gray-200 my-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          {/* Product Management (New) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm space-y-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <ImageIcon size={32} className="text-blue-600" /> {selectedTarget === 'landing' ? '메인 페이지' : `${categories.find(c => c.id === selectedTarget)?.name || '카테고리'}`} 하단 상품 진열 관리 (최대 5개)
              </h2>
              <button 
                onClick={addProduct}
                disabled={(config.products || []).length >= 5}
                className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Plus size={18} /> 상품 추가
              </button>
            </div>
            <div className="space-y-8">
              {(config.products || []).map((product, i) => (
                <div key={product.id || i} className="p-6 border border-gray-100 rounded-xl space-y-4 relative group shadow-sm">
                    <button 
                      onClick={() => deleteProduct(i)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="text-base font-bold text-red-600">상품 {i + 1}</div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                        <textarea 
                          value={product.title} 
                          onChange={(e) => updateProduct(i, 'title', e.target.value)}
                          className="w-full p-2 border rounded-md text-sm leading-relaxed resize-none"
                          rows={2}
                          placeholder="상품 제목"
                        />
                      </div>

                      <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">상품 이미지 URL</label>
                          <input 
                            type="text" 
                            value={product.imageUrl} 
                            onChange={(e) => updateProduct(i, 'imageUrl', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">이미지 설명 (Alt 태그)-선택사항.</label>
                          <input 
                            type="text" 
                            value={product.imageAlt || ''} 
                            onChange={(e) => updateProduct(i, 'imageAlt', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                            placeholder="이미지 설명"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="block text-base font-bold text-red-600 mb-1">본문 내용 (Markdown 지원)</label>
                        <textarea 
                          value={product.content || ''} 
                          onChange={(e) => updateProduct(i, 'content', e.target.value)}
                          className="w-full p-3 border rounded-md text-sm h-40 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="상품 상세 설명을 작성하세요..."
                        />
                      </div>

                      <div className="rounded-xl border border-purple-100 overflow-hidden shadow-sm">
                        <div className="p-4 bg-purple-50 space-y-3">
                          <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                            <Video size={14} /> 쇼츠 및 코멘트 설정
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">유튜브 쇼츠 ID</label>
                              <input 
                                type="text" 
                                value={product.youtubeId || ''} 
                                onChange={(e) => updateProduct(i, 'youtubeId', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs"
                                placeholder="ID만 입력 (예: dQw4w9WgXcQ)"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">쇼츠 하단 코멘트</label>
                              <input 
                                type="text" 
                                value={product.comment || ''} 
                                onChange={(e) => updateProduct(i, 'comment', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs"
                                placeholder="영상에 대한 코멘트"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">영상 비율</label>
                              <select 
                                value={product.aspectRatio || '9:16'} 
                                onChange={(e) => updateProduct(i, 'aspectRatio', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs bg-white"
                              >
                                <option value="9:16">9:16 (세로/쇼츠)</option>
                                <option value="16:9">16:9 (가로/일반)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-orange-50 border-t border-purple-100 space-y-3">
                          <div className="font-bold text-sm text-red-600 mb-1 flex items-center gap-1">
                            <LinkIcon size={14} /> 하단 CTA 버튼 설정
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">버튼 문구</label>
                              <input 
                                type="text" 
                                value={product.buttonText} 
                                onChange={(e) => updateProduct(i, 'buttonText', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs"
                                placeholder="가격 확인하기"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">사이트 주소 입력.</label>
                              <input 
                                type="text" 
                                value={product.link} 
                                onChange={(e) => updateProduct(i, 'link', e.target.value)}
                                className="w-full p-2 border rounded-md text-xs"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="h-px bg-gray-200 my-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {/* YouTube & Comments Section */}
          <div className="bg-white p-8 rounded-2xl shadow-sm space-y-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Video size={32} className="text-blue-600" /> {selectedTarget === 'landing' ? '메인 페이지' : `${categories.find(c => c.id === selectedTarget)?.name || '카테고리'}`} 하단 유튜브 & 코멘트 관리
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-base font-bold text-red-600">유튜브 영상 ID 목록</label>
                  <button 
                    onClick={() => setConfig(prev => ({ 
                      ...prev, 
                      youtubes: [...prev.youtubes, ''],
                      youtubeAspectRatios: [...(prev.youtubeAspectRatios || []), '9:16']
                    }))}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    + 추가
                  </button>
                </div>
                {config.youtubes.map((yt, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={yt} 
                        onChange={(e) => updateYoutube(i, e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="유튜브 ID (예: dQw4w9WgXcQ)"
                      />
                      <button 
                        onClick={() => setConfig(prev => ({ 
                          ...prev, 
                          youtubes: prev.youtubes.filter((_, idx) => idx !== i),
                          youtubeAspectRatios: (prev.youtubeAspectRatios || []).filter((_, idx) => idx !== i)
                        }))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium text-gray-500">영상 비율:</label>
                      <select 
                        value={(config.youtubeAspectRatios && config.youtubeAspectRatios[i]) || '9:16'} 
                        onChange={(e) => updateYoutubeAspectRatio(i, e.target.value)}
                        className="flex-1 p-1 border rounded text-[10px] focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="9:16">9:16 (세로/쇼츠)</option>
                        <option value="16:9">16:9 (가로/일반)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-700">실시간 코멘트 목록</label>
                  <button 
                    onClick={() => setConfig(prev => ({ ...prev, youtubeComments: [...(prev.youtubeComments || []), ''] }))}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    + 추가
                  </button>
                </div>
                {(config.youtubeComments || []).map((comment, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      type="text" 
                      value={comment} 
                      onChange={(e) => updateYoutubeComment(i, e.target.value)}
                      className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="코멘트 내용"
                    />
                    <button 
                      onClick={() => setConfig(prev => ({ ...prev, youtubeComments: (prev.youtubeComments || []).filter((_, idx) => idx !== i) }))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="sticky bottom-5 flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold shadow-2xl hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <Settings size={20} /> 설정 저장하기
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/post/:target/:id" element={<PostPage />} />
            <Route path="/category/:categoryId" element={<CategoryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
