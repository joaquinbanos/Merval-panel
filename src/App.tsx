import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Info, TrendingUp } from 'lucide-react';

// List of MERVAL stocks with their full names and Yahoo Finance symbols
const MERVAL_STOCKS = [
  { symbol: "YPFD.BA", name: "YPF" },
  { symbol: "GGAL.BA", name: "Grupo Financiero Galicia" },
  { symbol: "BMA.BA", name: "Banco Macro" },
  { symbol: "PAMP.BA", name: "Pampa Energía" },
  { symbol: "TECO2.BA", name: "Telecom Argentina" },
  { symbol: "TXAR.BA", name: "Ternium Argentina" },
  { symbol: "COME.BA", name: "Sociedad Comercial del Plata" },
  { symbol: "CRES.BA", name: "Cresud" },
  { symbol: "EDN.BA", name: "Edenor" },
  { symbol: "MIRG.BA", name: "Mirgor" },
  { symbol: "LOMA.BA", name: "Loma Negra" },
  { symbol: "TGSU2.BA", name: "Transportadora de Gas del Sur" },
  { symbol: "SUPV.BA", name: "Grupo Supervielle" },
  { symbol: "CEPU.BA", name: "Central Puerto" },
  { symbol: "AGRO.BA", name: "Agrometal" },
  { symbol: "ALUA.BA", name: "Aluar" },
  { symbol: "BBAR.BA", name: "Banco BBVA Argentina" },
  { symbol: "HARG.BA", name: "Holcim Argentina" },
  { symbol: "METR.BA", name: "MetroGAS" },
  { symbol: "TS", name: "Tenaris" }
];

interface StockData {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  loading: boolean;
  error: string | null;
}

function App() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<'ok' | 'limited' | 'error'>('ok');

  // Function to fetch stock price using a CORS proxy
  const fetchStockPrice = async (stock: { symbol: string; name: string }): Promise<{ price: number | null; change: number | null }> => {
    try {
      // Use a CORS proxy to access Yahoo Finance API
      const corsProxy = "https://corsproxy.io/?";
      const url = `${corsProxy}https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the current price and change percentage
      if (data && data.chart && data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0];
        const meta = result.meta;
        
        if (meta && meta.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const previousClose = meta.previousClose || meta.chartPreviousClose;
          const change = previousClose ? ((price - previousClose) / previousClose) * 100 : null;
          
          return { price, change };
        }
      }
      
      throw new Error('Could not extract price data from response');
    } catch (error) {
      console.error(`Error fetching data for ${stock.symbol}:`, error);
      return { price: null, change: null };
    }
  };

  // Alternative method using a different endpoint
  const fetchStockPriceAlternative = async (stock: { symbol: string; name: string }): Promise<{ price: number | null; change: number | null }> => {
    try {
      // Use a CORS proxy with a different Yahoo Finance endpoint
      const corsProxy = "https://corsproxy.io/?";
      const url = `${corsProxy}https://query2.finance.yahoo.com/v10/finance/quoteSummary/${stock.symbol}?modules=price`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && 
          data.quoteSummary && 
          data.quoteSummary.result && 
          data.quoteSummary.result[0] && 
          data.quoteSummary.result[0].price) {
        
        const priceData = data.quoteSummary.result[0].price;
        const price = priceData.regularMarketPrice?.raw || null;
        const change = priceData.regularMarketChangePercent?.raw || null;
        
        return { price, change };
      }
      
      throw new Error('Could not extract price data from response');
    } catch (error) {
      console.error(`Error fetching alternative data for ${stock.symbol}:`, error);
      return { price: null, change: null };
    }
  };

  // Fallback method using a different CORS proxy
  const fetchStockPriceFallback = async (stock: { symbol: string; name: string }): Promise<{ price: number | null; change: number | null }> => {
    try {
      // Use a different CORS proxy as a last resort
      const corsProxy = "https://api.allorigins.win/raw?url=";
      const encodedUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stock.symbol}`);
      const url = `${corsProxy}${encodedUrl}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && 
          data.quoteResponse && 
          data.quoteResponse.result && 
          data.quoteResponse.result[0]) {
        
        const quoteData = data.quoteResponse.result[0];
        const price = quoteData.regularMarketPrice || null;
        const change = quoteData.regularMarketChangePercent || null;
        
        return { price, change };
      }
      
      throw new Error('Could not extract price data from response');
    } catch (error) {
      console.error(`Error fetching fallback data for ${stock.symbol}:`, error);
      return { price: null, change: null };
    }
  };

  // Function to update all stock data
  const updateAllStocks = async () => {
    setIsRefreshing(true);
    setApiStatus('ok'); // Reset API status
    
    // Initialize with loading state
    const initialStocks = MERVAL_STOCKS.map(stock => ({
      ...stock,
      price: null,
      change: null,
      loading: true,
      error: null
    }));
    
    setStocks(initialStocks);
    
    // Fetch all stock prices with a small delay between requests
    const updatedStocks: StockData[] = [];
    let errorCount = 0;
    
    for (const stock of MERVAL_STOCKS) {
      // Try primary method first
      let result = await fetchStockPrice(stock);
      
      // If primary method fails, try alternative method
      if (result.price === null) {
        result = await fetchStockPriceAlternative(stock);
      }
      
      // If alternative method fails, try fallback method
      if (result.price === null) {
        result = await fetchStockPriceFallback(stock);
      }
      
      if (result.price === null) {
        errorCount++;
      }
      
      updatedStocks.push({
        ...stock,
        price: result.price,
        change: result.change,
        loading: false,
        error: result.price === null ? "Error fetching price" : null
      });
      
      // Update stocks incrementally as they come in
      setStocks([...updatedStocks, ...initialStocks.slice(updatedStocks.length)]);
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Update API status based on error count
    if (errorCount > MERVAL_STOCKS.length / 2) {
      setApiStatus('error');
    } else if (errorCount > 3) {
      setApiStatus('limited');
    }
    
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Initial data fetch
  useEffect(() => {
    updateAllStocks();
    
    // Set up interval for updates (every 5 minutes to avoid rate limiting)
    const intervalId = setInterval(updateAllStocks, 300000); // 5 minutes
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Calculate how many stocks have data
  const stocksWithData = stocks.filter(stock => stock.price !== null).length;
  const dataPercentage = stocks.length > 0 ? (stocksWithData / stocks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="bg-white rounded-lg shadow-md p-6 mb-6 border-t-4 border-blue-600">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp size={28} className="text-blue-600 mr-2" />
            <h1 className="text-3xl font-bold text-center text-gray-800">MERVAL - Precios en Tiempo Real</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <p className="text-gray-600">
                  {lastUpdated ? (
                    `Última actualización: ${lastUpdated.toLocaleTimeString()}`
                  ) : (
                    'Cargando datos...'
                  )}
                </p>
                
                {apiStatus !== 'ok' && (
                  <div className="flex items-center text-amber-600 gap-1">
                    <Info size={16} />
                    <span className="text-sm">
                      {apiStatus === 'limited' 
                        ? 'Algunos datos no disponibles' 
                        : 'Problemas con la API'}
                    </span>
                  </div>
                )}
              </div>
              
              {stocks.length > 0 && (
                <div className="mt-1 text-sm text-gray-500">
                  Datos disponibles: {stocksWithData} de {stocks.length} acciones ({dataPercentage.toFixed(0)}%)
                </div>
              )}
            </div>
            
            <button 
              onClick={updateAllStocks}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:bg-blue-400 shadow-sm"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {stocks.map((stock) => (
            <div key={stock.symbol} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{stock.symbol.replace('.BA', '')}</h2>
                  <p className="text-xs text-gray-500 truncate max-w-[150px]" title={stock.name}>
                    {stock.name}
                  </p>
                </div>
                
                {!stock.loading && stock.change !== null && (
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    stock.change > 0 
                      ? 'bg-green-100 text-green-800' 
                      : stock.change < 0 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                  </span>
                )}
              </div>
              
              {stock.loading ? (
                <div className="mt-3 h-6 bg-gray-200 animate-pulse rounded"></div>
              ) : stock.error ? (
                <div className="flex items-center gap-1 mt-3 text-red-500">
                  <AlertCircle size={16} />
                  <span>Sin datos</span>
                </div>
              ) : (
                <p className="text-lg mt-3 font-medium text-gray-700">
                  ARS ${stock.price?.toFixed(2)}
                </p>
              )}
            </div>
          ))}
        </div>
        
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p className="mt-1">Los precios se actualizan automáticamente cada 5 minutos</p>
          <p className="mt-1">Esta aplicación es solo para fines informativos</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
