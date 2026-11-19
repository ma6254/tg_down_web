import { SearchXIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { buttonVariants } from "@/components/ui/button"

/** 404：壳内展示，保留导航可继续操作。 */
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="页面不存在" description="地址可能写错了，或页面已被移除。" />
      <EmptyState
        icon={SearchXIcon}
        title="404"
        description="没有找到这个页面。"
        action={
          <Link to="/accounts" className={buttonVariants()}>
            返回账号页
          </Link>
        }
      />
    </>
  )
}
