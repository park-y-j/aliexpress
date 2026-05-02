import express, { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import serverless from "serverless-http";

const app = express();
const router = Router();
app.use(express.json());

// Log requested path for debugging Netlify functions
app.use((req, res, next) => {
  console.log(`[API Request] Method: ${req.method}, Path: ${req.path}, OriginalUrl: ${req.originalUrl}`);
  next();
});

// Health check
router.get("/health", (req, res) => res.json({ status: "ok", env: process.env.NODE_ENV, timestamp: new Date().toISOString(), host: req.headers.host }));

// Ping check
router.get("/ping", (req, res) => res.send("pong"));

// Referer logic for Coupang API
const getReferer = (reqReferer: string | undefined, host: string) => {
  if (reqReferer && reqReferer.includes("localhost")) return "https://1688mall.kr";
  if (host.includes("xn--3r5bng313aa") || host.includes("일육팔팔")) return "https://xn--3r5bng313aa.com";
  if (host.includes("xn--om2b25i") || host.includes("알리")) return "https://xn--om2b25i.com";
  return reqReferer || "https://1688mall.kr";
};

// Coupang API Proxy
router.get("/coupang/search", async (req, res) => {
  const { keyword } = req.query;
  const host = req.headers.host || "";
  const referer = getReferer(req.headers.referer as string, host);
  
  if (!keyword) {
    return res.status(400).json({ error: "Keyword is required" });
  }

  const accessKey = (process.env.COUPANG_ACCESS_KEY || "").trim();
  const secretKey = (process.env.COUPANG_SECRET_KEY || "").trim();

  const debug = {
    keyword,
    host,
    referer,
    keys_present: !!(accessKey && secretKey),
    access_key_preview: accessKey ? accessKey.substring(0, 5) + "..." : "missing",
    env: process.env.NODE_ENV || "unknown",
    timestamp: new Date().toISOString()
  };

  if (!accessKey || !secretKey) {
    return res.json({
      data: [], 
      debug_info: { ...debug, status: "Keys Missing" },
      is_fallback: true
    });
  }

  const apiPaths = [
    "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search",
    "/v2/providers/openapi/apis/openapi/v1/products/search"
  ];

  let allErrors: any[] = [];

  for (const path of apiPaths) {
    try {
      const method = "GET";
      const query = `keyword=${encodeURIComponent(keyword as string)}&limit=3`; 
      const fullPath = `${path}?${query}`;
      
      const now = new Date();
      const date = now.toISOString()
        .split(".")[0]
        .replace(/[:\-]/g, "")
        .slice(2) + "Z";
      
      const salt = `${date}${method}${path}${query}`;
      
      const signature = crypto
        .createHmac("sha256", secretKey)
        .update(salt)
        .digest("hex");

      const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;

      const response = await axios.get(`https://api-gateway.coupang.com${fullPath}`, {
        headers: {
          "Authorization": authorization,
          "Accept": "application/json",
          "Content-Type": "application/json;charset=UTF-8",
          "Referer": referer.includes("localhost") || !referer.includes(".") ? "https://1688mall.kr" : referer,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });

      let items = response.data?.data?.productData || response.data?.data || response.data || [];
      
      if (Array.isArray(items) && items.length > 0) {
        const normalizedItems = items.slice(0, 3).map((item: any) => {
          let img = item.productImage || item.image || item.thumbUrl || "";
          if (img.startsWith("//")) img = `https:${img}`;
          
          // Use wsrv.nl proxy for all Coupang images to bypass referrer/CORS issues
          if (img && (img.includes("coupangcdn.com") || img.includes("coupang.com") || img.includes("ads-partners.coupang.com"))) {
            // Use wsrv.nl which is a robust public image proxy
            img = `https://wsrv.nl/?url=${encodeURIComponent(img)}`;
          } else if (img && !img.startsWith("http")) {
            // Ensure http prefix if it's just a domain or relative path from Coupang
            img = `https://${img.replace(/^\/+/, '')}`;
          }

          return {
            ...item,
            productId: String(item.productId || `cp_${Math.random().toString(36).slice(2, 9)}`),
            productName: item.productName || item.title || "상품 정보 없음",
            productPrice: item.productPrice || item.price || 0,
            productImage: img,
            productUrl: item.productUrl || item.link || "https://www.coupang.com"
          };
        });

        return res.json({ data: normalizedItems });
      }
      
      allErrors.push({ path, result: response.data });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      allErrors.push({ path, error: errorData });
    }
  }

  // fallback
  res.json({
    data: [
      {
        productId: `fb_1`,
        productName: `[특별추천] ${keyword} 인기 순위 1위 상품`,
        productPrice: 48900,
        productImage: "https://picsum.photos/seed/p1/400/400",
        productUrl: "https://www.coupang.com",
        isMock: true
      },
      {
        productId: `fb_2`,
        productName: `[가성비] ${keyword} 실속형 베스트 모델`,
        productPrice: 29500,
        productImage: "https://picsum.photos/seed/p2/400/400",
        productUrl: "https://www.coupang.com",
        isMock: true
      },
      {
        productId: `fb_3`,
        productName: `[인기상품] ${keyword} 프리미엄 패키지`,
        productPrice: 89000,
        productImage: "https://picsum.photos/seed/p3/400/400",
        productUrl: "https://www.coupang.com",
        isMock: true
      }
    ],
    debug_info: {
      ...debug,
      last_error: allErrors,
      status: "Direct API Failed"
    },
    is_fallback: true
  });
});

// Image Proxy
router.get("/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("URL is required");

  const targetUrl = decodeURIComponent(url as string);
  
  const fetchImage = async (referer: string | undefined) => {
    return await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'arraybuffer',
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(referer ? { "Referer": referer } : {})
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status === 200
    });
  };

  try {
    // Try with Coupang Referer first
    try {
      const response = await fetchImage("https://www.coupang.com");
      const contentType = response.headers['content-type'] || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(response.data);
    } catch (e1) {
      // Try without Referer
      const response = await fetchImage(undefined);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(response.data);
    }
  } catch (error: any) {
    console.error(`Proxy failure for ${targetUrl}:`, error.message);
    // If proxy fails, redirect to the original URL as last resort, or fallback image
    if (targetUrl.startsWith('http')) {
      return res.redirect(targetUrl);
    }
    res.redirect(`https://picsum.photos/seed/err/400/400`);
  }
});

app.use("/api", router);
app.use("/", router);

// Catch-all for 404s
app.use((req, res) => {
  console.log(`[API 404] Path: ${req.path}, Method: ${req.method}`);
  res.status(404).json({ 
    error: "API route not found", 
    path: req.path,
    method: req.method,
    tip: "If you see this on Netlify, please check if the path includes /api prefix twice or if it is missing."
  });
});

export const handler = serverless(app);
