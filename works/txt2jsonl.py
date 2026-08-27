import json
import re

def parse_poetry_txt(input_file, output_file):
    """
    将特定格式的TXT诗集转换为JSONL格式。
    每行一个JSON对象，包含 title, date, content, description, chapter（章节名）。
    输出顺序以目录中的诗歌顺序为准。
    """
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # ---------- 1. 解析目录 ----------
    try:
        dir_start = next(i for i, line in enumerate(lines) if line.strip() == '#目录')
    except StopIteration:
        raise ValueError("未找到 '#目录' 标记")
    try:
        dir_end = next(i for i, line in enumerate(lines[dir_start+1:], start=dir_start+1) if line.strip() == '#正文')
    except StopIteration:
        raise ValueError("未找到 '#正文' 标记")

    dir_lines = lines[dir_start+1:dir_end]

    chapters = []          # 按顺序存储 {'name': 章节名, 'poems': [诗名列表]}
    current_chapter = None

    for line in dir_lines:
        stripped = line.strip()
        if not stripped:
            continue
        # 匹配章节标记：—— 章节名 ——
        m = re.match(r'^—— (.+) ——$', stripped)
        if m:
            chapter_name = m.group(1).strip()
            current_chapter = {'name': chapter_name, 'poems': []}
            chapters.append(current_chapter)
        else:
            # 否则视为当前章节下的诗名
            if current_chapter is not None:
                current_chapter['poems'].append(stripped)
            # 忽略目录开始前的无关行（如果有）

    # 建立诗名 -> 章节名的映射（直接使用章节名称）
    poem_to_chapter_name = {}
    for ch in chapters:
        ch_name = ch['name']
        for poem_title in ch['poems']:
            poem_to_chapter_name[poem_title] = ch_name

    # ---------- 2. 解析正文 ----------
    body_lines = lines[dir_end+1:]

    # 跳过正文开头的全横线分隔行（如"————————————————"）
    while body_lines and re.match(r'^——+$', body_lines[0].strip()):
        body_lines.pop(0)

    # 使用字典存储解析结果，键为诗名
    poems_dict = {}
    i = 0
    n = len(body_lines)

    while i < n:
        line = body_lines[i].rstrip('\n')
        stripped = line.strip()

        # 跳过空行
        if not stripped:
            i += 1
            continue

        # 检查是否为诗歌分隔线（仅由若干个'——'组成）
        if re.match(r'^——+$', stripped):
            # 开始解析一首新诗
            i += 1
            # 跳过可能存在的空行，直到找到标题行
            while i < n and not body_lines[i].strip():
                i += 1
            if i >= n:
                break

            # 标题行，格式：标题   日期（三个以上空格分隔）
            title_line = body_lines[i].rstrip('\n')
            i += 1

            # 尝试用正则匹配三个以上空格
            m = re.match(r'^(.+?)\s{3,}(.+)$', title_line)
            if m:
                title = m.group(1).strip()
                date = m.group(2).strip()
            else:
                # 备用方案：按空白分割，取第一个为标题，其余合并为日期
                parts = title_line.split()
                if len(parts) >= 2:
                    title = parts[0]
                    date = ' '.join(parts[1:])
                else:
                    title = title_line
                    date = ""

            # 收集诗歌内容，直到遇到下一个分隔线或章节标记
            content_lines = []
            while i < n:
                next_line = body_lines[i].rstrip('\n')
                next_stripped = next_line.strip()
                # 遇到分隔线或章节标记（—— 章节名 ——）则停止收集
                if re.match(r'^——+$', next_stripped) or re.match(r'^—— .+ ——$', next_stripped):
                    break
                content_lines.append(next_line)
                i += 1
            # 注意：遇到停止标记时，未消费该行，下一次外层循环会处理

            # 组合内容
            content = '\n'.join(content_lines)

            # 提取 description（如果内容末尾有一行以 '-- ' 开头）
            description = ""
            if content:
                lines_list = content.splitlines()
                if lines_list:
                    last_line = lines_list[-1].strip()
                    if last_line.startswith('-- '):
                        description = last_line[3:].strip()   # 去掉 '-- '
                        lines_list.pop()                      # 从内容中移除该行
                        content = '\n'.join(lines_list)

            # 查找所属章节（直接使用章节名）
            chapter_name = poem_to_chapter_name.get(title, "")
            if not chapter_name:
                # 如果目录中未找到，打印警告并留空章节
                print(f"警告：未在目录中找到诗名 '{title}'，章节将留空")

            record = {
                "title": title,
                "date": date,
                "content": content,
                "description": description,
                "chapter": chapter_name   # 直接存储章节名
            }
            poems_dict[title] = record

        elif re.match(r'^—— .+ ——$', stripped):
            # 章节标记（如"—— 叶之梦 ——"），直接跳过
            i += 1
        else:
            # 其他无关行，跳过
            i += 1

    # ---------- 3. 按目录顺序输出 JSONL ----------
    results = []
    for ch in chapters:
        for poem_title in ch['poems']:
            if poem_title in poems_dict:
                results.append(poems_dict[poem_title])
            else:
                print(f"警告：目录中的诗名 '{poem_title}' 未在正文中找到")

    # 输出所有在正文中但不在目录中的诗（放在最后）
    for title, record in poems_dict.items():
        if title not in poem_to_chapter_name:
            results.append(record)

    with open(output_file, 'w', encoding='utf-8') as f:
        for rec in results:
            rec['content'] = rec['content'].lstrip()
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')

    print(f"成功解析 {len(results)} 首诗，输出至 {output_file}")


if __name__ == '__main__':
    # 使用示例（请将诗集原文保存为 poetry.txt）
    parse_poetry_txt('poetry.txt', 'poetry.jsonl')