import React from 'react'
import { Layout, Menu, Button, Space, Dropdown, Tooltip, theme } from 'antd'
import {
  MessageOutlined,
  ProfileOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  UploadOutlined,
  UserOutlined,
  LogoutOutlined,
  CodeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore, type SiderMode } from '@/stores/appStore'
import WindowSettings from '@/components/WindowSettings'

const { Sider, Content, Header } = Layout

const menuItems = [
  { key: '/chat', icon: <MessageOutlined />, label: 'AI 对话' },
  { key: '/positions', icon: <ProfileOutlined />, label: '岗位管理' },
  { key: '/knowledge', icon: <DatabaseOutlined />, label: '知识库' },
  { key: '/question-bank', icon: <CodeOutlined />, label: '题库' },
  { key: '/report', icon: <FileTextOutlined />, label: '面试报告' },
  { key: '/upload', icon: <UploadOutlined />, label: '文件上传' },
]

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  // 系统音频监听状态由 ChatPage 写入，这里只负责展示
  const systemAudioListening = useAppStore((s) => s.systemAudioListening)
  const systemAudioSttConnected = useAppStore((s) => s.systemAudioSttConnected)
  const systemAudioError = useAppStore((s) => s.systemAudioError)
  // 侧边栏显示模式（持久化在 appStore，刷新后保持）
  const siderMode = useAppStore((s) => s.siderMode)
  const toggleSiderCollapsed = useAppStore((s) => s.toggleSiderCollapsed)
  const toggleSiderHidden = useAppStore((s) => s.toggleSiderHidden)
  // 全屏会话模式：整页只留对话内容，侧边栏 / 顶栏都让位（开关在对话页工具栏）
  const focusMode = useAppStore((s) => s.focusMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  // 取当前主题 token，使写死的底色/边框跟随用户选择
  const { token } = theme.useToken()

  // 兜底：localStorage 里若存了非法值（例如手改过或旧版本遗留），
  // 一律按 expanded 处理，避免 Sider 收到未知值后渲染异常
  const mode: SiderMode =
    siderMode === 'collapsed' || siderMode === 'hidden' ? siderMode : 'expanded'
  const hidden = mode === 'hidden'

  const selectedKey = menuItems.find((item) =>
    location.pathname.startsWith(item.key),
  )?.key || '/chat'

  // Ctrl/Cmd + B：通用的「收起侧边栏」快捷键
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 全屏会话模式没有侧边栏，快捷键没有意义，忽略以免误改下次进入时的布局
      if (focusMode) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSiderCollapsed()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSiderCollapsed, focusMode])

  // Esc：退出全屏会话模式。
  // 布局层监听而不是对话页，是因为对话页可能因路由切换而卸载，
  // 那样会留下「全屏开着却没有出口」的状态（顶栏里的按钮已经藏起来了）。
  // 注意只认「没有弹窗打开」的 Esc：antd 的 Modal 关闭时也会派发 Esc，
  // 不判断的话关掉弹窗会顺带把全屏一起退掉。
  React.useEffect(() => {
    if (!focusMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.ant-modal-wrap, .ant-dropdown, .ant-popover')) return
      toggleFocusMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusMode, toggleFocusMode])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems = [
    {
      key: 'email',
      label: user?.email || '',
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ height: focusMode ? '100vh' : undefined, minHeight: '100vh' }}>
      {/* 隐藏模式直接不渲染 Sider：用 collapsedWidth=0 会留下零宽占位，
          且 antd 的零宽触发器会在左侧留下一个悬浮条。
          全屏会话模式同样不渲染，把整屏让给对话 */}
      {!hidden && !focusMode && (
        <Sider
          breakpoint="lg"
          collapsedWidth="64"
          collapsed={mode === 'collapsed'}
          collapsible
          trigger={null}
          theme="light"
          style={{
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              color: token.colorText,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {/* 折叠时只留图标，避免文字被挤成换行 */}
            {mode === 'collapsed' ? '🎯' : '🎯 面试 Agent'}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, marginTop: 8, background: 'transparent' }}
          />
        </Sider>
      )}
      <Layout>
        {/* 全屏会话模式隐藏整条顶栏（导航 / 设置 / 用户菜单都在里面）。
            退出入口由对话页工具栏的按钮和 Esc 提供，不会「进去出不来」 */}
        {!focusMode && (
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 16px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
          }}
        >
          <Space size={8}>
            {/* 侧边栏开关：隐藏后这里是唯一的入口，所以必须常驻 Header */}
            <Tooltip
              title={
                hidden
                  ? '显示侧边栏（Ctrl+B）'
                  : mode === 'collapsed'
                    ? '展开侧边栏（Ctrl+B）'
                    : '收起侧边栏（Ctrl+B）'
              }
            >
              <Button
                type="text"
                aria-label={hidden ? '显示侧边栏' : '收起侧边栏'}
                icon={hidden ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleSiderCollapsed}
              />
            </Tooltip>
            {/* 完全隐藏：彻底腾出横向空间（做题/演示时有用）。
                用不同的图标与第一个按钮区分，避免两个「折叠」图标混淆 */}
            {!hidden && (
              <Tooltip title="完全隐藏侧边栏（腾出整屏横向空间）">
                <Button
                  type="text"
                  aria-label="完全隐藏侧边栏"
                  icon={<CloseOutlined />}
                  onClick={toggleSiderHidden}
                />
              </Tooltip>
            )}
            <span style={{ fontSize: 14, color: token.colorTextSecondary }}>
              DeepSeek 驱动 · RAG 增强面试助手
            </span>
          </Space>
          <Space size={4}>
            {/* 设置（配色 / 窗口 / 系统音频监听）；窗口项在浏览器中自动隐藏 */}
            <WindowSettings
              systemAudioListening={systemAudioListening}
              systemAudioSttConnected={systemAudioSttConnected}
              systemAudioError={systemAudioError}
            />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {user?.display_name || user?.email || '用户'}
              </Button>
            </Dropdown>
          </Space>
        </Header>
        )}
        <Content
          style={{
            // 上留白照旧；底部收窄 —— 输入框是页面最底部的元素，
            // 留 24px 会在窗口底边多出一截空白，收到 8px 更紧凑
            padding: focusMode ? 8 : '24px 24px 8px',
            // 跟随用户选择的背景色（由 ConfigProvider 注入）
            background: token.colorBgLayout,
            color: token.colorText,
            // 全屏会话：外层 Layout 已被约束成 100vh，这里用 minHeight:0 + flex:1
            // 把它压成「剩余空间」，让对话区自己滚动。
            // 关键是不能让内容把 Content 撑高——否则整页出现滚动条，
            // 底部输入框被推到视口外（就是之前输入框显示不全的原因）。
            ...(focusMode
              ? {
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  // 声明成 column flex 容器，内部对话区用 flex:1 撑满
                  // （高度由 flex 分配，不再依赖百分比高度）
                  display: 'flex',
                  flexDirection: 'column',
                }
              : { overflow: 'auto' }),
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
