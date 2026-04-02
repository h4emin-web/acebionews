DELETE FROM news_articles WHERE 
  title ~ '선임|취임|임명|부임|위촉|영입' 
  AND title !~ '임상|신약|허가|승인|파이프라인'
  AND date >= '2026-03-01';

DELETE FROM news_articles WHERE 
  title ~ '개최|기념행사|기념식|주년|개원|시상|수상|표창|공로상'
  AND title !~ '임상|결과|데이터|승인|허가|신약'
  AND date >= '2026-03-01';

DELETE FROM news_articles WHERE
  title ~ '대표이사|사내이사|사외이사|부회장|이사장'
  AND title !~ '임상|신약|허가|파이프라인'
  AND date >= '2026-03-01';

DELETE FROM news_articles WHERE
  title ~ '론칭|런칭|주총|주주총회'
  AND title !~ '임상|신약|허가|승인|FDA|EMA'
  AND date >= '2026-03-01';