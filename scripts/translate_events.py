"""将选举模拟器JSON数据文件中的事件标题和内容翻译为中文"""
import json
import os

# 所有事件的中文翻译映射 (key = 英文标题)
EVENT_TRANSLATIONS = {
    # === 2020 事件 ===
    "COVID-19 Pandemic Response": {
        "title": "新冠疫情应对",
        "content": "特朗普总统宣布全国紧急状态，新冠疫情在美国蔓延。疫情应对成为2020年竞选的核心议题，封锁措施、口罩强制令和经济救助等议题主导了政治讨论。"
    },
    "George Floyd Protests / BLM Movement": {
        "title": "乔治·弗洛伊德抗议 / 黑人命也是命运动",
        "content": "明尼阿波利斯警方杀害乔治·弗洛伊德引发全国性抗议，黑人命也是命运动再度兴起。抗议活动蔓延至全部50个州，成为美国历史上规模最大的抗议运动之一。事件在警务、种族正义和法治问题上极化了选民。"
    },
    "First Presidential Debate": {
        "title": "首场总统辩论",
        "content": "特朗普与拜登的首场总统辩论被普遍认为是混乱和对抗性的。辩论中频繁打断和人身攻击，主持人难以维持秩序。辩论后民调显示拜登在未决定选民中略占优势。"
    },
    "Trump COVID Diagnosis": {
        "title": "特朗普确诊新冠",
        "content": "特朗普总统宣布他和第一夫人梅拉尼娅·特朗普新冠检测呈阳性。他在沃尔特·里德医疗中心住院三天。这一诊断打乱了竞选最后阶段，并引发对政府疫情应对的质疑。"
    },
    "Election Day": {
        "title": "选举日",
        "content": "2020年总统选举投票率创历史新高，超过1.59亿张选票。由于大量邮寄选票，多个关键摇摆州的结果耗时数日才确定。拜登最终以306张选举人票击败特朗普的232票，但特朗普对结果提出质疑。"
    },

    # === 2024 事件 ===
    "Biden-Trump TV Debate": {
        "title": "拜登-特朗普电视辩论",
        "content": "拜登总统在与特朗普的首场总统辩论中表现不佳，引发民主党内部对其连任能力的严重担忧。拜登时而显得困惑、思路中断、声音嘶哑。这场表现触发民主党内部要求拜登退选的浪潮。"
    },
    "Trump Shot at Rally": {
        "title": "特朗普集会遭枪击",
        "content": "前总统特朗普在宾夕法尼亚州巴特勒市竞选集会上遭枪击，耳朵受伤。这起暗杀企图震惊全美。特勤局迅速护送特朗普离场，特朗普举拳高喊'战斗，战斗，战斗'。一名观众遇难，两人重伤。该事件产生了标志性画面，并在共和党选民中激发了强烈的支持浪潮。"
    },
    "Trump Confirmed as Republican Nominee": {
        "title": "特朗普确认为共和党候选人",
        "content": "唐纳德·特朗普在威斯康星州密尔沃基的共和党全国代表大会上正式确认为共和党总统候选人。大会在暗杀事件仅两天后团结在特朗普周围，传递力量与韧性的统一信息。俄亥俄州参议员JD·万斯被宣布为特朗普的竞选搭档。"
    },
    "Biden Withdraws, Endorses Harris": {
        "title": "拜登退选，支持哈里斯",
        "content": "拜登总统宣布退出2024年总统竞选，在辩论表现不佳后屈从于民主党领导人和捐助者的压力。拜登支持副总统卡玛拉·哈里斯作为民主党候选人。这一公告重塑了竞选格局，激发了民主党的基层活力，重置了竞选动态。"
    },

    # === 2026 事件 ===
    "Trump Second Inauguration and Executive Order Blitz": {
        "title": "特朗普第二任期就职与行政令风暴",
        "content": "特朗普在国会大厦极端天气中宣誓就任第47任总统，JD·万斯任副总统。上任首日签署超100项行政令：宣布南部边境国家紧急状态、再次退出巴黎气候协定、退出世卫组织、赦免1月6日事件被告、冻结联邦招聘、下令大规模驱逐行动。如此大量的行动标志着强硬的'第二特朗普时代'。市场和盟国迅速重新评估政策。国内反应极度两极化——支持者庆祝果断行动，反对者谴责威权越界。"
    },
    "Tariff War Escalation Shakes Global Economy": {
        "title": "关税战升级震动全球经济",
        "content": "特朗普政府推出全面的'解放日'关税——对大多数进口商品征收10%基准关税，对等关税高达中国34%、加拿大和墨西哥25%。中国立即报复。标普500指数大幅下跌，电子产品和汽车消费价格飙升，依赖跨境供应链的小企业面临生存危机。农业州因中国取消农产品订单遭受重创。4月9日，多数国家关税暂停90天，但中国关税升至145%。制造业州和港口城市爆发抗议，反对生活成本上升和就业损失。"
    },
    "White House Shooting Incident": {
        "title": "白宫枪击事件",
        "content": "白宫周边发生枪击事件。特勤局特工介入并击毙嫌疑人。该事件引发全国关于总统安全和政治暴力升级气候的辩论。CNN和福克斯新闻持续报道。华盛顿特区安保立即升级。社交媒体充斥阴谋论和党派反应。事件唤起对2024年特朗普集会枪击的记忆，加深了国民对安全的焦虑。"
    },
    "Immigration Raids and Nationwide Protest Wave": {
        "title": "移民搜捕与全国抗议浪潮",
        "content": "强硬的移民执法导致洛杉矶、纽约和芝加哥大规模ICE搜捕行动。多座城市爆发抗议。特朗普总统将2000名加州国民警卫队联邦化，并部署700名海军陆战队员至洛杉矶，明确无视州长纽森的反对——这是自1965年以来总统首次未经州长同意这样做。纽森起诉联邦政府，称其违宪。民变法辩论占据头条。洛杉矶市中心实施宵禁。该事件成为现代美国历史上最严重的国内对抗之一。"
    },
    "Big Beautiful Bill Tax and Spending Package": {
        "title": "大规模税收与支出法案",
        "content": "'一个大美丽法案'在参议院通过——一项大规模和解法案，使2017年特朗普减税永久化，取消小费和加班税，提高SALT扣除上限，同时以新的工作要求大幅削减医疗补助和食品券。国防和边境安全获得大量资金。通胀削减法案中的清洁能源税收抵免被撤销。该法案预计十年内增加3万亿美元以上国家赤字。民主党一致反对，称其是向富人输送利益、剥夺数百万人医疗保健。大规模街头抗议爆发。国会辩论激烈。"
    },
    "US-Iran Military Conflict Escalation": {
        "title": "美伊军事冲突升级",
        "content": "以色列与伊朗冲突升级为直接军事对抗。以色列对伊朗军事和核相关设施发动大规模打击。伊朗以弹道导弹袭击以色列城市作为报复。美国直接介入冲突：B-2隐形轰炸机打击伊朗福尔多、纳坦兹和伊斯法罕核设施。油价飙升至90美元/桶以上。霍尔木兹海峡受到威胁。中国和俄罗斯谴责打击行动。国会在未经授权的战争权力问题上分裂。全球市场暴跌。'这是第三次世界大战吗？'占据每个新闻频道。全国军事部署增加。"
    },
    "US-China Diplomatic Summit on Trade and Technology": {
        "title": "中美贸易与科技外交峰会",
        "content": "中美之间举行高级别外交峰会——这是多年来的首次此类会晤。峰会涵盖贸易减免框架、AI治理合作、能源伙伴关系和区域缓和。宣布了关税减免框架协议，以及AI安全标准合作。股市因贸易乐观情绪上涨。然而，美国媒体深度分裂：保守派媒体称之为外交胜利，自由派媒体批评在人权和地区安全上的让步。'缓和还是绥靖'的政治辩论主导了中期选举。"
    },
    "SpaceX Historic IPO and Musk Trillionaire Milestone": {
        "title": "SpaceX历史性IPO与马斯克万亿富翁里程碑",
        "content": "SpaceX以美国金融史上最大规模IPO上市，融资约750亿美元。首日交易市值超过2万亿美元。埃隆·马斯克净资产突破1万亿美元，成为史上首位达到该里程碑的人。养老基金和指数基金成为被动持有者。华尔街庆祝，但事件引发巨大公众反弹：批评者谴责'科技寡头'和财富集中。左翼政客要求征收财富税。'创新庆祝'与'不平等愤怒'之间的文化分裂成为中期选举的决定性议题。"
    },
    "US-Iran Ceasefire and Oil Market Reversal": {
        "title": "美伊停火与石油市场逆转",
        "content": "经过数月升级，美国和伊朗接近达成停火协议。战争风险骤降。国际油价剧烈波动——从90美元以上跌向60美元。全球市场急剧逆转。能源成本下降改善通胀预期。投资市场重新定价。特朗普宣称这是外交胜利，但批评者质疑此前数月冲突的代价。快速逆转令选民情绪震荡——如释重负中夹杂着对混乱的愤怒。石油冲击对消费价格和供应链调整的经济影响持续存在。"
    },
}

# 域名翻译
DOMAIN_TRANSLATIONS = {
    "health": "健康",
    "social": "社会",
    "politics": "政治",
    "security": "安全",
    "economy": "经济",
}

def translate_events_in_file(filepath):
    """翻译JSON文件中的事件标题和内容"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    changed = False

    # 处理顶层events数组
    if 'events' in data and isinstance(data['events'], list):
        for event in data['events']:
            if isinstance(event, dict) and 'title' in event:
                en_title = event['title']
                if en_title in EVENT_TRANSLATIONS:
                    event['title'] = EVENT_TRANSLATIONS[en_title]['title']
                    event['content'] = EVENT_TRANSLATIONS[en_title]['content']
                    if 'domain' in event and event['domain'] in DOMAIN_TRANSLATIONS:
                        event['domain'] = DOMAIN_TRANSLATIONS[event['domain']]
                    changed = True

    # 处理snapshots中的事件 (2026 stepwise)
    if 'snapshots' in data and isinstance(data['snapshots'], list):
        for snap in data['snapshots']:
            if isinstance(snap, dict) and 'event_title' in snap:
                en_title = snap['event_title']
                if en_title in EVENT_TRANSLATIONS:
                    snap['event_title'] = EVENT_TRANSLATIONS[en_title]['title']
                    changed = True

    # 处理emotion_waves中的事件标题
    if 'emotion_waves' in data and isinstance(data['emotion_waves'], list):
        for wave in data['emotion_waves']:
            if isinstance(wave, dict) and 'title' in wave:
                en_title = wave['title']
                if en_title in EVENT_TRANSLATIONS:
                    wave['title'] = EVENT_TRANSLATIONS[en_title]['title']
                    changed = True
            if isinstance(wave, dict) and 'event_title' in wave:
                en_title = wave['event_title']
                if en_title in EVENT_TRANSLATIONS:
                    wave['event_title'] = EVENT_TRANSLATIONS[en_title]['title']
                    changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ 已翻译: {filepath}")
    else:
        print(f"⚠️ 无匹配事件: {filepath}")

# 处理所有JSON文件
data_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'data')
public_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')

json_files = [
    os.path.join(data_dir, 'election_2020_results.json'),
    os.path.join(data_dir, 'election_2024_results.json'),
    os.path.join(data_dir, 'election_2026_stepwise.json'),
    os.path.join(data_dir, 'election_2026_glm.json'),
    os.path.join(data_dir, 'election_2026_ensemble.json'),
    os.path.join(public_dir, 'election_2026_ensemble.json'),
]

for f in json_files:
    if os.path.exists(f):
        translate_events_in_file(f)
    else:
        print(f"❌ 文件不存在: {f}")

print("\n🎉 翻译完成！")
