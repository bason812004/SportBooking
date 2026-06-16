import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";

export function PartnerBlogsPage() {
  const queryClient = useQueryClient();
  const blogs = useQuery({ queryKey: ["partner-blogs"], queryFn: partnerApi.blogs });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "submit" | "delete" }) => type === "submit" ? partnerApi.submitBlog(id) : partnerApi.deleteBlog(id),
    onSuccess: async () => { toast.success("Đã cập nhật bài viết"); await queryClient.invalidateQueries({ queryKey: ["partner-blogs"] }); },
    onError: e => toast.error(e.message)
  });
  if (blogs.isLoading) return <LoadingState />; if (blogs.isError) return <ErrorState message={blogs.error.message}/>;
  return <div className="space-y-5"><div className="flex justify-between"><div><h1 className="text-3xl font-bold">Bài viết</h1><p className="text-slate-600">Tạo nội dung giới thiệu sân và hoạt động thể thao.</p></div><Link to="/partner/blogs/create"><Button><Plus className="h-4 w-4"/>Viết bài</Button></Link></div>{blogs.data?.length===0&&<EmptyState title="Chưa có bài viết"/>}<div className="grid gap-4">{blogs.data?.map(blog=><article key={blog.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><h2 className="font-bold">{blog.title}</h2><p className="text-sm text-slate-600">{blog.status} · {new Date(blog.createdAt).toLocaleDateString("vi-VN")}</p></div><div className="flex gap-2">{blog.status==="DRAFT"&&<><Link to={`/partner/blogs/${blog.id}/edit`}><Button variant="secondary">Sửa</Button></Link><Button onClick={()=>action.mutate({id:blog.id,type:"submit"})}>Gửi duyệt</Button><Button variant="danger" onClick={()=>action.mutate({id:blog.id,type:"delete"})}>Xóa</Button></>}</div></article>)}</div></div>;
}
