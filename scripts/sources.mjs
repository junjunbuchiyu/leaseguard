/**
 * 法规来源清单（抓取与构建共用）
 *
 * 约定：
 *  - 只收录与「住房租赁合同」直接相关的条文
 *  - range：从整部法律中截取某个条文区间（含首尾）
 *  - picks：区间之外额外挑选的条文（如合同编通则里的解除、违约金条款）
 *  - sourceUrl 保留可点击的原文地址，报告中每条引用都能回溯到这里
 */
export const SOURCES = [
  {
    key: 'minfadian',
    law: '中华人民共和国民法典',
    short: '民法典',
    level: '法律',
    effectiveDate: '2021-01-01',
    chapter: '第三编 合同',
    url: 'https://www.gzrd.gov.cn/xwzx/rdyw/202006/t20200602_77652025.html',
    range: [703, 734],
    picks: [
      509, // 全面履行与诚信原则
      563, // 法定解除
      577, // 违约责任
      584, // 损失赔偿范围
      585, // 违约金及调整
      590, // 不可抗力
    ],
  },
  {
    key: 'tiaoli',
    law: '住房租赁条例',
    short: '住房租赁条例',
    level: '行政法规',
    effectiveDate: '2025-09-15',
    url: 'https://www.gov.cn/zhengce/content/202507/content_7032955.htm',
  },
  {
    key: 'banfa',
    law: '商品房屋租赁管理办法',
    short: '商品房屋租赁管理办法',
    level: '部门规章',
    effectiveDate: '2011-02-01',
    url: 'https://www.gov.cn/gongbao/content/2011/content_1845070.htm',
  },
]
