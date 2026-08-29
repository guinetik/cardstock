/**
 * The board and anything laid over it. `modal` is the parallel slot the
 * intercepted card route renders into; it is empty everywhere else.
 */
export default function BoardLayout({
  children,
  modal,
}: LayoutProps<"/p/[project]/b/[board]">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
