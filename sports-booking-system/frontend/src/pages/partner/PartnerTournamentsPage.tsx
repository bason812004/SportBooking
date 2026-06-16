import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";

export function PartnerTournamentsPage(){
  const qc=useQueryClient(); const tournaments=useQuery({queryKey:["partner-tournaments"],queryFn:partnerApi.tournaments});
  const action=useMutation({mutationFn:({id,type}:{id:string;type:"submit"|"delete"})=>type==="submit"?partnerApi.submitTournament(id):partnerApi.deleteTournament(id),onSuccess:async()=>{toast.success("Đã cập nhật giải đấu");await qc.invalidateQueries({queryKey:["partner-tournaments"]})},onError:e=>toast.error(e.message)});
  if(tournaments.isLoading)return <LoadingState/>;if(tournaments.isError)return <ErrorState message={tournaments.error.message}/>;
  return <div className="space-y-5"><div className="flex justify-between"><div><h1 className="text-3xl font-bold">Giải đấu</h1><p className="text-slate-600">Tổ chức giải tại các sân thuộc hệ thống của bạn.</p></div><Link to="/partner/tournaments/create"><Button><Plus className="h-4 w-4"/>Tạo giải</Button></Link></div>{tournaments.data?.length===0&&<EmptyState title="Chưa có giải đấu"/>}<div className="grid gap-4">{tournaments.data?.map(item=><article key={item.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="text-sm text-slate-600">{item.courtName} · {new Date(item.startDate).toLocaleDateString("vi-VN")} · {item.status}</p></div>{item.status==="DRAFT"&&<div className="flex gap-2"><Link to={`/partner/tournaments/${item.id}/edit`}><Button variant="secondary">Sửa</Button></Link><Button onClick={()=>action.mutate({id:item.id,type:"submit"})}>Gửi duyệt</Button><Button variant="danger" onClick={()=>action.mutate({id:item.id,type:"delete"})}>Xóa</Button></div>}</div></article>)}</div></div>;
}
