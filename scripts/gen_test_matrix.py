#!/usr/bin/env python3
"""全站体验走查清单生成脚本 — 派单 58"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

wb = openpyxl.Workbook()

# =========== 样式定义 ===========
header_font = Font(name="微软雅黑", size=11, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
section_font = Font(name="微软雅黑", size=11, bold=True, color="2F5496")
section_fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
normal_font = Font(name="微软雅黑", size=10)
red_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
thin_border = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin")
)
center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

def style_header_row(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

def style_section_row(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = section_font
        cell.fill = section_fill
        cell.border = thin_border

def style_data_row(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = normal_font
        cell.alignment = center_align if col <= 6 else left_align
        cell.border = thin_border

# =========== Sheet 1: 前端页面走查清单 ===========
ws1 = wb.active
ws1.title = "前端页面走查"

# 用 tab 颜色标识站点
tab_colors = {
    "Web主站": "4472C4",
    "Admin管理后台": "ED7D31",
    "Studio工作台": "70AD47",
    "User用户中心": "FFC000",
    "Ops运维中心": "5B9BD5",
    "后端API": "A5A5A5"
}

# 前端页面数据: (站点, 路由路径, 页面名称, 核心交互元素, 测试人, 设备要求)
pages = [
    # ===== Web 主站 =====
    ("Web主站", "/", "首页 HomeView", "导航栏、Hero区域、CTA按钮、特性展示区、Footer链接", "林染/赵千影", "📱💻"),
    ("Web主站", "/showcase", "案例展示 ShowcaseView", "案例卡片列表、筛选标签、翻页、案例详情弹窗", "林染/赵千影", "📱💻"),
    ("Web主站", "/login", "登录页 LoginView", "手机号输入框、验证码按钮、登录按钮、注册链接、第三方登录入口", "林染/赵千影", "📱💻"),
    ("Web主站", "/dashboard", "用户仪表盘 DashboardView", "统计卡片、快捷入口按钮、项目列表、通知提醒", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio", "创作者工作台 StudioHomeView", "项目列表、新建按钮、模板选择、筛选搜索", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/project/:id", "项目编辑器 ProjectEditorView", "工具栏、画布区、属性面板、保存/预览/导出按钮", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/models", "模型选择器 ModelSelectorView", "模型卡片、筛选下拉、详情弹窗、收藏/取消收藏", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/byok", "BYOK设置 ByokSettingsView", "API Key输入框、供应商下拉、连接测试按钮、保存按钮", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/progress", "生成进度 GenerationProgressView", "进度条、任务列表、取消按钮、重试按钮、下载按钮", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/storyboard/:pid", "分镜编辑器 StoryboardEditorView", "分镜网格、拖拽排序、编辑弹窗、生成按钮", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/characters", "角色库 CharacterLibraryView", "角色卡片、搜索框、新建按钮、编辑弹窗", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/scenes", "场景库 SceneLibraryView", "场景卡片、搜索框、新建按钮、场景编辑弹窗", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/assets", "资产货架 AssetShelfView", "资产列表、分类筛选、上传按钮、删除确认弹窗", "林染/赵千影", "📱💻"),
    ("Web主站", "/studio/export", "导出 ExportView", "格式选择、分辨率设置、导出按钮、进度提示", "林染/赵千影", "📱💻"),

    # ===== Admin 管理后台 =====
    ("Admin管理后台", "/dashboard", "仪表盘 DashboardView", "统计卡片(KPI)、图表(ECharts)、筛选日期、导出报表", "林染/赵千影", "💻"),
    ("Admin管理后台", "/users", "用户管理 UsersView", "用户表格、搜索框、筛选下拉、批量操作、用户详情弹窗、封禁/解封按钮", "林染/赵千影", "💻"),
    ("Admin管理后台", "/billing", "计费管理 BillingView", "套餐列表、价格编辑、优惠券管理、收入图表", "林染/赵千影", "💻"),
    ("Admin管理后台", "/audit", "审计日志 AuditView", "日志表格、时间筛选、操作人筛选、详情弹窗", "林染/赵千影", "💻"),
    ("Admin管理后台", "/settings", "系统设置 SettingsView", "配置表单、保存按钮、重置按钮、开关(Toggle)、下拉选择", "林染/赵千影", "💻"),
    ("Admin管理后台", "/ops", "业务运营 OpsView", "运营数据图表、配置表单、规则开关", "林染/赵千影", "💻"),
    ("Admin管理后台", "/compliance", "合规审计 ComplianceView", "合规规则列表、规则开关、违规记录表格", "林染/赵千影", "💻"),
    ("Admin管理后台", "/projects", "项目审核 AdminProjectsView", "项目列表、审核通过/驳回按钮、审核意见输入框", "林染/赵千影", "💻"),
    ("Admin管理后台", "/logs", "系统日志 AdminLogsView", "日志表格、搜索框、级别筛选、时间范围筛选、详情弹窗", "林染/赵千影", "💻"),

    # ===== Studio 工作台（独立应用） =====
    ("Studio工作台", "/", "首页 HomeView", "欢迎页、快速新建按钮、最近项目列表、模板推荐", "林染/赵千影", "📱💻"),
    ("Studio工作台", "/materials", "素材库 MaterialLibraryView", "标签切换(Characters/Scenes)、素材卡片、上传按钮、搜索框", "林染/赵千影", "📱💻"),
    ("Studio工作台", "/workflow", "工作流 WorkflowDesignerView", "节点画布、连线、节点面板、保存/运行按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/project", "项目编辑器 ProjectEditorView", "剧本编辑器、工具栏、保存按钮、预览按钮", "林染/赵千影", "📱💻"),
    ("Studio工作台", "/tools", "工具箱 ToolboxView", "工具卡片列表、筛选、收藏", "林染/赵千影", "📱💻"),
    ("Studio工作台", "/export", "导出 ExportView", "格式选择、参数配置、导出按钮", "林染/赵千影", "📱💻"),
    ("Studio工作台", "/project/:id/shots", "分镜网格 StoryboardGridView", "分镜缩略图网格、排序拖拽、批量生成按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/project/:id/shots/:sid", "分镜编辑器 ShotEditorView", "图片编辑区、Prompt输入框、生成/重绘按钮、历史版本", "林染/赵千影", "💻"),
    ("Studio工作台", "/project/:id/settings", "项目设置 ProjectSettingsView", "表单(名称/描述/封面)、保存/取消按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/project/new", "新建项目向导 NewProjectWizardView", "步骤条(Step 1-4)、表单输入、上一步/下一步按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/characters/:id/edit", "角色编辑 CharacterEditView", "表单(名称/属性)、图片上传、Prompt模板", "林染/赵千影", "💻"),
    ("Studio工作台", "/scenes/:id/edit", "场景编辑 SceneEditView", "表单(名称/属性)、图片上传、Prompt模板", "林染/赵千影", "💻"),
    ("Studio工作台", "/workflow/node/:id", "节点配置 NodeConfigView", "节点参数表单、模型选择、保存/取消按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/workflow/batch", "批量生成 BatchGenerateView", "项目选择、批次数输入、开始按钮、进度条", "林染/赵千影", "💻"),
    ("Studio工作台", "/workflow/branch", "分支配置 BranchConfigView", "分支条件表单、分支预览、保存按钮", "林染/赵千影", "💻"),
    ("Studio工作台", "/export/settings", "导出设置 ExportSettingsView", "详细参数表单(分辨率/格式/水印)、预览按钮、导出按钮", "林染/赵千影", "💻"),

    # ===== User 用户中心 =====
    ("User用户中心", "/dashboard", "首页 HomeView", "欢迎卡片、快捷入口、统计数据", "林染/赵千影", "📱💻"),
    ("User用户中心", "/projects", "我的项目 MyProjectsView", "项目卡片列表、新建按钮、搜索框、排序下拉", "林染/赵千影", "📱💻"),
    ("User用户中心", "/works", "我的作品 MyWorksView", "作品列表、发布状态标签、分享按钮、删除确认弹窗", "林染/赵千影", "📱💻"),
    ("User用户中心", "/assets", "素材库 AssetLibraryView", "素材分类筛选、上传按钮、批量选择、删除确认", "林染/赵千影", "📱💻"),
    ("User用户中心", "/settings", "设置 SettingsView", "个人信息表单、头像上传、密码修改表单、保存按钮", "林染/赵千影", "📱💻"),
    ("User用户中心", "/byok", "API Key管理 ApiKeysView", "Key列表、新增Key表单、删除确认弹窗、测试连通性按钮", "林染/赵千影", "📱💻"),
    ("User用户中心", "/team", "团队 TeamView", "成员列表、邀请按钮、角色管理下拉、移除确认弹窗", "林染/赵千影", "📱💻"),
    ("User用户中心", "/profile", "编辑资料 ProfileEditView", "头像裁剪、昵称输入框、简介输入框、保存按钮", "林染/赵千影", "📱💻"),

    # ===== Ops 运维中心 =====
    ("Ops运维中心", "/dashboard", "数据看板 DashboardView", "系统指标图表、告警列表、服务状态卡片、刷新按钮", "林染/谢擎", "💻"),
    ("Ops运维中心", "/users", "用户管理 UsersView", "用户表格、搜索框、状态筛选、批量操作按钮", "林染/谢擎", "💻"),
    ("Ops运维中心", "/billing", "计费充值 BillingView", "充值记录表格、手动充值表单、退款审批按钮", "林染/谢擎", "💻"),
    ("Ops运维中心", "/monitoring", "系统监控 MonitoringView", "服务状态列表、指标图表、告警规则配置、静默按钮", "林染/谢擎", "💻"),
    ("Ops运维中心", "/system", "系统管理 SystemView", "配置项列表、编辑表单、重启服务按钮(危险操作)", "林染/谢擎", "💻"),
    ("Ops运维中心", "/logs", "运维日志 OpsLogsView", "日志流、搜索过滤、级别筛选、下载按钮", "林染/谢擎", "💻"),
]

# 写表头
headers = ["序号", "站点", "路由路径", "页面名称", "核心交互元素/检查点", "前端测试人", "视觉测试", "内容测试", "后端测试", "测试状态", "Bug数", "备注"]
ws1.append(headers)
style_header_row(ws1, 1, len(headers))

# 写数据
current_site = ""
for i, (site, path, name, elements, tester, devices) in enumerate(pages, 1):
    if site != current_site:
        current_site = site
        # 插入站点分隔行
        row_num = ws1.max_row + 1
        ws1.append([f"📂 {site}  — 共 {sum(1 for p in pages if p[0]==site)} 页"] + [""] * (len(headers) - 1))
        style_section_row(ws1, row_num, len(headers))

    row_num = ws1.max_row + 1
    ws1.append([i, site, path, name, elements, tester, devices, "林知行", "谢擎", "⬜ 待测", 0, ""])
    style_data_row(ws1, row_num, len(headers))

# 合计行
total_row = ws1.max_row + 1
ws1.append(["", "合计", f"{len(pages)} 页面", "", "", "", "", "", "", "⬜ 待测", 0, ""])
style_section_row(ws1, total_row, len(headers))

# 设置列宽
col_widths = [6, 16, 30, 28, 50, 16, 10, 10, 10, 12, 8, 20]
for i, w in enumerate(col_widths, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# =========== Sheet 2: 后端API走查清单 ===========
ws2 = wb.create_sheet("后端API走查")

api_headers = ["序号", "服务", "方法", "端点路径", "功能描述", "鉴权要求", "请求参数", "测试人", "测试状态", "状态码", "Bug数", "备注"]
ws2.append(api_headers)
style_header_row(ws2, 1, len(api_headers))

apis = [
    # user-service
    ("user-service", "GET", "/health", "健康检查", "无", "无", "谢擎"),
    ("user-service", "POST", "/auth/register", "用户注册", "无", "phone/code/password", "谢擎"),
    ("user-service", "POST", "/auth/login", "用户登录", "无", "phone/password", "谢擎"),
    ("user-service", "POST", "/auth/refresh", "刷新Token", "无", "refreshToken", "谢擎"),
    ("user-service", "POST", "/auth/verify-email", "验证邮箱", "无", "token", "谢擎"),
    ("user-service", "POST", "/auth/forgot-password", "忘记密码", "无", "phone", "谢擎"),
    ("user-service", "POST", "/auth/reset-password", "重置密码", "无", "token/newPassword", "谢擎"),
    ("user-service", "POST", "/auth/verify-2fa", "验证2FA", "无", "token/code", "谢擎"),
    ("user-service", "POST", "/auth/logout", "登出", "需要", "refreshToken", "谢擎"),
    ("user-service", "POST", "/auth/logout-all", "全设备登出", "需要", "无", "谢擎"),
    ("user-service", "GET", "/me", "获取当前用户", "需要", "无", "谢擎"),
    ("user-service", "PATCH", "/me", "更新个人信息", "需要", "nickname/avatar等", "谢擎"),
    ("user-service", "POST", "/me/password", "修改密码", "需要", "oldPwd/newPwd", "谢擎"),
    ("user-service", "GET", "/me/2fa", "获取2FA状态", "需要", "无", "谢擎"),
    ("user-service", "POST", "/me/2fa/enable", "启用2FA", "需要", "无", "谢擎"),
    ("user-service", "POST", "/me/2fa/confirm", "确认2FA", "需要", "token", "谢擎"),
    ("user-service", "POST", "/me/2fa/disable", "禁用2FA", "需要", "token", "谢擎"),
    ("user-service", "GET", "/users", "用户列表(管理员)", "需要+Admin", "page/size/query", "谢擎"),
    ("user-service", "GET", "/users/:id", "用户详情", "需要", "无", "谢擎"),
    ("user-service", "PATCH", "/users/:id", "管理员更新用户", "需要+Admin", "role/status等", "谢擎"),
    ("user-service", "DELETE", "/users/:id", "删除用户(超管)", "需要+SuperAdmin", "无", "谢擎"),
    ("user-service", "GET", "/user/api-keys", "用户API Key列表", "需要", "无", "谢擎"),
    ("user-service", "POST", "/user/api-keys", "创建API Key", "需要", "name/provider/key", "谢擎"),
    ("user-service", "DELETE", "/user/api-keys/:id", "删除API Key", "需要", "无", "谢擎"),

    # billing-service
    ("billing-service", "GET", "/health", "健康检查", "无", "无", "谢擎"),
    ("billing-service", "GET", "/subscriptions", "套餐列表", "无", "无", "谢擎"),
    ("billing-service", "POST", "/subscriptions", "订阅套餐", "需要", "planId", "谢擎"),
    ("billing-service", "GET", "/orders", "订单列表", "需要", "page/size", "谢擎"),
    ("billing-service", "POST", "/orders", "创建订单", "需要", "planId/amount", "谢擎"),
    ("billing-service", "GET", "/invoices", "发票列表", "需要", "page/size", "谢擎"),
    ("billing-service", "POST", "/payment/callback", "支付回调", "无", "orderId/txId", "谢擎"),
    ("billing-service", "GET", "/quota", "配额查询", "需要", "无", "谢擎"),
    ("billing-service", "POST", "/refunds", "申请退款", "需要", "orderId/reason", "谢擎"),
    ("billing-service", "GET", "/billing/cost-logs", "费用日志", "需要", "dateRange", "谢擎"),
    ("billing-service", "POST", "/billing/recharge", "充值", "需要", "amount", "谢擎"),

    # collab-service
    ("collab-service", "GET", "/health", "健康检查", "无", "无", "谢擎"),
    ("collab-service", "POST", "/comments", "创建评论", "需要", "projectId/body", "谢擎"),
    ("collab-service", "GET", "/comments", "评论列表", "需要", "projectId/page", "谢擎"),
    ("collab-service", "PATCH", "/comments/:id", "编辑评论", "需要", "body", "谢擎"),
    ("collab-service", "POST", "/comments/:id/resolve", "解决评论", "需要", "无", "谢擎"),
    ("collab-service", "DELETE", "/comments/:id", "删除评论", "需要", "无", "谢擎"),
    ("collab-service", "GET", "/presence/project/:pid", "项目在线用户", "需要", "无", "谢擎"),
    ("collab-service", "GET", "/notifications/unread-count", "未读通知数", "需要", "无", "谢擎"),
    ("collab-service", "GET", "/stats", "公开统计", "无", "无", "谢擎"),
]

for i, (svc, method, path, desc, auth, params, tester) in enumerate(apis, 1):
    row_num = ws2.max_row + 1
    ws2.append([i, svc, method, path, desc, auth, params, tester, "⬜ 待测", "", 0, ""])
    style_data_row(ws2, row_num, len(api_headers))

total_row2 = ws2.max_row + 1
ws2.append(["", "合计", "", f"{len(apis)} 端点", "", "", "", "", "⬜ 待测", "", 0, ""])
style_section_row(ws2, total_row2, len(api_headers))

api_col_widths = [6, 16, 8, 32, 20, 15, 25, 10, 12, 10, 8, 20]
for i, w in enumerate(api_col_widths, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

# =========== Sheet 3: 视觉响应式走查 ===========
ws3 = wb.create_sheet("视觉响应式走查")

visual_headers = ["序号", "站点", "视口设备", "宽度", "测试项", "测试人", "测试状态", "Bug描述", "Bug数", "截图路径"]
ws3.append(visual_headers)
style_header_row(ws3, 1, len(visual_headers))

sites_5 = ["Web主站", "Admin管理后台", "Studio工作台", "User用户中心", "Ops运维中心"]
viewports = [
    ("📱 iPhone SE", 375),
    ("📱 iPhone 14 Pro", 390),
    ("📱 iPad 竖屏", 768),
    ("📱 iPad 横屏", 1024),
    ("💻 Desktop", 1440),
    ("💻 UltraWide", 2560),
]

idx = 0
for site in sites_5:
    for vp_name, vp_width in viewports:
        idx += 1
        tests = "UI错位/文字遮挡/按钮可用性/图片拉伸/横向滚动/导航适配/表单可用性/字体大小/加载卡顿/颜色对比度"
        row_num = ws3.max_row + 1
        ws3.append([idx, site, vp_name, f"{vp_width}px", tests, "赵千影", "⬜ 待测", "", 0, ""])
        style_data_row(ws3, row_num, len(visual_headers))

total_row3 = ws3.max_row + 1
ws3.append(["", "合计", f"{len(sites_5)*len(viewports)} 视口×站点", "", "", "", "⬜ 待测", "", 0, ""])
style_section_row(ws3, total_row3, len(visual_headers))

vis_col_widths = [6, 16, 18, 10, 55, 12, 12, 20, 8, 30]
for i, w in enumerate(vis_col_widths, 1):
    ws3.column_dimensions[get_column_letter(i)].width = w

# =========== Sheet 4: 内容走查清单 ===========
ws4 = wb.create_sheet("内容走查清单")

content_headers = ["序号", "站点", "路由路径", "页面名称", "文字量(估)", "检查项", "测试人", "测试状态", "问题数", "截图路径"]
ws4.append(content_headers)
style_header_row(ws4, 1, len(content_headers))

content_sites = [
    # Web 主站 (含 Studio 子路由)
    ("Web主站", "/", "首页", "大量", "林知行"),
    ("Web主站", "/showcase", "案例展示", "中等", "林知行"),
    ("Web主站", "/login", "登录页", "少量", "林知行"),
    ("Web主站", "/dashboard", "仪表盘", "少量", "林知行"),
    ("Web主站", "/studio", "工作台首页", "中等", "林知行"),
    # Admin
    ("Admin管理后台", "/dashboard", "仪表盘", "少量", "林知行"),
    ("Admin管理后台", "/users", "用户管理", "少量", "林知行"),
    ("Admin管理后台", "/billing", "计费管理", "中等", "林知行"),
    ("Admin管理后台", "/audit", "审计日志", "少量", "林知行"),
    ("Admin管理后台", "/settings", "系统设置", "中等", "林知行"),
    ("Admin管理后台", "/ops", "业务运营", "少量", "林知行"),
    ("Admin管理后台", "/compliance", "合规审计", "少量", "林知行"),
    ("Admin管理后台", "/projects", "项目审核", "少量", "林知行"),
    ("Admin管理后台", "/logs", "系统日志", "少量", "林知行"),
    # Studio
    ("Studio工作台", "/", "首页", "中等", "林知行"),
    ("Studio工作台", "/materials", "素材库", "中等", "林知行"),
    ("Studio工作台", "/workflow", "工作流", "少量", "林知行"),
    ("Studio工作台", "/project", "项目编辑", "大量", "林知行"),
    ("Studio工作台", "/tools", "工具箱", "中等", "林知行"),
    ("Studio工作台", "/export", "导出页", "少量", "林知行"),
    # User
    ("User用户中心", "/dashboard", "首页", "少量", "林知行"),
    ("User用户中心", "/projects", "我的项目", "少量", "林知行"),
    ("User用户中心", "/works", "我的作品", "少量", "林知行"),
    ("User用户中心", "/assets", "素材库", "少量", "林知行"),
    ("User用户中心", "/settings", "设置", "中等", "林知行"),
    ("User用户中心", "/byok", "API Key", "少量", "林知行"),
    ("User用户中心", "/team", "团队", "中等", "林知行"),
    ("User用户中心", "/profile", "编辑资料", "中等", "林知行"),
    # Ops
    ("Ops运维中心", "/dashboard", "数据看板", "少量", "林知行"),
    ("Ops运维中心", "/users", "用户管理", "少量", "林知行"),
    ("Ops运维中心", "/billing", "计费充值", "少量", "林知行"),
    ("Ops运维中心", "/monitoring", "系统监控", "少量", "林知行"),
    ("Ops运维中心", "/system", "系统管理", "中等", "林知行"),
    ("Ops运维中心", "/logs", "运维日志", "少量", "林知行"),
]

checks = "错别字/断句/图片加载/弃读风险/Alt文本/链接有效/统一用语/中英混杂"
for i, (site, path, name, text_amount, tester) in enumerate(content_sites, 1):
    row_num = ws4.max_row + 1
    ws4.append([i, site, path, name, text_amount, checks, tester, "⬜ 待测", 0, ""])
    style_data_row(ws4, row_num, len(content_headers))

total_row4 = ws4.max_row + 1
ws4.append(["", "合计", "", f"{len(content_sites)} 页面", "", "", "", "⬜ 待测", 0, ""])
style_section_row(ws4, total_row4, len(content_headers))

ct_col_widths = [6, 16, 20, 18, 10, 45, 10, 12, 8, 30]
for i, w in enumerate(ct_col_widths, 1):
    ws4.column_dimensions[get_column_letter(i)].width = w

# =========== Sheet 5: 汇总仪表盘 ===========
ws5 = wb.create_sheet("汇总仪表盘")

summary_data = [
    ["📊 全站体验走查汇总 — 2026-06-11"],
    [""],
    ["项目", "数量", "已测", "合格率", "P0", "P1", "P2", "状态"],
    ["前端页面 (5站)", "46", "0", "0%", "0", "0", "0", "🔴 未开始"],
    ["后端API端点 (3服务)", "44", "0", "0%", "0", "0", "0", "🔴 未开始"],
    ["视觉视口 (5站×6设备)", "30", "0", "0%", "0", "0", "0", "🔴 未开始"],
    ["内容审查页面", "34", "0", "0%", "0", "0", "0", "🔴 未开始"],
    ["", "", "", "", "", "", "", ""],
    ["测试人员", "角色", "负责项", "状态", "已测页", "发现Bug", "", ""],
    ["林染 🎨", "前端总监", "UI交互52页+API接口", "⏳ 待命", "0", "0", "", ""],
    ["谢擎 ⚙️", "后端总监", "API 44端点+交叉前端", "⏳ 待命", "0", "0", "", ""],
    ["林知行 📝", "内容主管", "内容34页+文字走查", "⏳ 待命", "0", "0", "", ""],
    ["赵千影 🎬", "漫改总监", "视觉30视口×站点", "⏳ 待命", "0", "0", "", ""],
    ["程构 🔧", "架构师", "测试监理+汇总", "⏳ 待命", "0", "0", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["关键里程碑", "时间", "负责人", "", "", "", "", ""],
    ["SOP签发", "00:12 6/11", "陈远枢 ✅", "", "", "", "", ""],
    ["全站测试启动", "00:30 6/11", "全员", "", "", "", "", ""],
    ["前端UI首轮测试完成", "06:00 6/11", "林染", "", "", "", "", ""],
    ["后端API首轮测试完成", "06:00 6/11", "谢擎", "", "", "", "", ""],
    ["视觉响应式首轮完成", "06:00 6/11", "赵千影", "", "", "", "", ""],
    ["内容审查首轮完成", "08:00 6/11", "林知行", "", "", "", "", ""],
    ["Bug汇总+优先级排定", "10:00 6/11", "程构", "", "", "", "", ""],
    ["第一轮修复完成", "18:00 6/11", "林染+谢擎", "", "", "", "", ""],
    ["第二轮回归测试", "20:00 6/11", "全员", "", "", "", "", ""],
    ["终验交付大哥", "22:00 6/11", "陈远枢", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["📋 合格标准", "", "", "", "", "", "", ""],
    ["✔️ 前端46页100%测试通过", "", "", "", "", "", "", ""],
    ["✔️ 后端44端点100%测试通过", "", "", "", "", "", "", ""],
    ["✔️ 视觉30视口100%测试通过", "", "", "", "", "", "", ""],
    ["✔️ 内容34页100%审查通过", "", "", "", "", "", "", ""],
    ["✔️ P0 Bug = 0", "", "", "", "", "", "", ""],
    ["✔️ P1 Bug ≤ 3", "", "", "", "", "", "", ""],
]

for row_data in summary_data:
    ws5.append(row_data)

# 样式标题行
ws5.merge_cells("A1:H1")
ws5.cell(row=1, column=1).font = Font(name="微软雅黑", size=14, bold=True, color="2F5496")
ws5.cell(row=1, column=1).alignment = Alignment(horizontal="center", vertical="center")

# 样式表头行
for hdr_row in [3, 9, 17]:
    for col in range(1, 9):
        cell = ws5.cell(row=hdr_row, column=col)
        if cell.value:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border

# 样式数据行
for r in range(4, len(summary_data) + 1):
    for c in range(1, 9):
        cell = ws5.cell(row=r, column=c)
        if cell.value:
            cell.font = normal_font
            cell.alignment = center_align
            cell.border = thin_border

# 列宽
sum_col_widths = [30, 15, 20, 12, 12, 12, 12, 15]
for i, w in enumerate(sum_col_widths, 1):
    ws5.column_dimensions[get_column_letter(i)].width = w

# =========== 保存 ===========
output_path = r"D:\ManhuaWorks\docs\testing\FULL_SITE_TEST_MATRIX_2026-06-11.xlsx"
wb.save(output_path)
import sys
sys.stdout.reconfigure(encoding='utf-8')
print(f"[OK] Test matrix generated: {output_path}")
print(f"   Sheet1 Frontend pages: {len(pages)}")
print(f"   Sheet2 API endpoints: {len(apis)}")
print(f"   Sheet3 Visual viewports: {len(sites_5)*len(viewports)}")
print(f"   Sheet4 Content pages: {len(content_sites)}")
print(f"   Sheet5 Dashboard")
