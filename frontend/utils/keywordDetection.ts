export const containsCropKeywords = (text: string) => {
  const t = text.toLowerCase();
  return /(npk|n[\s,]*p[\s,]*k|nitrogen|phosphorus|potassium|ph\b|my soil|soil has|soil n|soil p|soil k|soil report|which crop|what crop|recommend crop|suggest crop|konsa crop|kaun si fasal|best crop for|crop for my soil|kya ugaun|kya lagaun|konte crop|konse crop|crops grow|crops here|grow here|yahan kya ugta|kya lagta|fasal batao|crop batao|which crops|local crop|crop for this|crop in this|is jagah|is ilake|kya bona|kya boun|kaun sa beej|fasal kaun si|kaunsi fasal|kya ugta|kya ugti|kaunsa bij)/.test(t);
};

export const containsPestKeywords = (text: string) => {
  const t = text.toLowerCase();
  // Pest problems and pesticide advice — not direct buy/shop queries
  return /(pest risk|insect problem|keeda|keede|worm in|infestation|disease in|fungus on|blight|leaf damage|crop damage|keedmaar|bug attack|keede lag|fasal mein keede|meri fasal|spray karna|keet|konsa pesticide|kaunsa pesticide|which pesticide|pesticide chahiye|pesticide use|pesticide batao|keede se bachna|keede se bachne|keede bhagana|keede mar|patte par|daag|jhulsa|sukhna|murrjhana|patton mein|rog|beemari|fungicide|insecticide)/.test(t) &&
    !/(buy|shop|store|kharid|dukan)/.test(t);
};

export const containsYieldKeywords = (text: string) => {
  const t = text.toLowerCase();
  // Also catch Hindi profit/yield queries like "2 acre lagau to profit kitna milega"
  // Pattern: number + acre/bigha + (crop) + profit/kamai/income keyword
  const hasAcreWithProfit = /(acre|bigha|hectare|jameen).{0,40}(profit|kamai|kitna|income|milega|earn|labh|faida)/.test(t)
    || /(profit|kamai|income|milega|earn|labh|faida).{0,40}(acre|bigha|hectare|jameen)/.test(t);
  return hasAcreWithProfit || /(yield|how much will|kitna milega|kitni paidavar|production estimate|per acre output|harvest amount|profit from|income from|earning from|kamai|paidavar|faida|labh|forecast yield|yield dashboard|kitna hoga|kitne quintal|kitna paisa|kitna kamaunga|agar.*lagau|lagane se|ugane se profit)/.test(t);
};

export const containsWeatherKeywords = (text: string) => {
  const t = text.toLowerCase();
  return /(weather|mausam|how is weather|today temperature|rainfall today|forecast|humidity today|monsoon|farm weather|near my farm|barish|baarish|tapman|garmi|sardi|badal|aaj ka mausam|kal ka mausam|temperature aaj|baarish hogi|mosam)/.test(t);
};

export const containsMarketKeywords = (text: string) => {
  const t = text.toLowerCase();
  return /(mandi|market price|market rate|apmc|bhav|today rate|selling price|₹.*quintal|rate per quintal|sell.*crop|wholesale price|mandi bhav|fasal ka bhav|kitne mein bik|bechna hai|fasal bechna|bhav kya hai|aaj ka bhav|rate kya hai|mandi rate|sabse accha bhav|kaun si mandi)/.test(t);
};

export const containsFertilizerKeywords = (text: string) => {
  const t = text.toLowerCase();
  return /(fertilizer|fertiliser|khad|urea|dap|npk dose|nutrient gap|soil gap|soil deficiency|soil correction|how much fertilizer|which fertilizer|fertilizer plan|soil amendment|kaunsa khad|kitna khad|khad batao|khad dena|gehun ke liye khad|wheat fertilizer|rice fertilizer|crop ke liye khad|khad kab dein|khad ki matra|top dressing|micronutrient|zinc sulphate|boron|khad schedule|potash|muriate|superphosphate|what changes|changes needed|changes to grow|changes required|soil improvement|improve.*soil|soil.*improve|kya karna padega|kya badlav|kya sudhaar|sudharna chahiye|growing conditions|requirements to grow|conditions to grow|kaise ugaun|ugane ke liye kya)/.test(t);
};
