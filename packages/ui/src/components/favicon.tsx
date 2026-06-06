import { Link, Meta } from "@solidjs/meta"
import { PRODUCT_NAME } from "../brand"

export const Favicon = () => {
  return (
    <>
      <Link rel="icon" type="image/png" href="/orgn-favicon-96x96.png" sizes="96x96" />
      <Link rel="icon" type="image/svg+xml" href="/orgn-favicon.svg" />
      <Link rel="shortcut icon" href="/orgn-favicon.ico" />
      <Link rel="apple-touch-icon" sizes="180x180" href="/orgn-apple-touch-icon.png" />
      <Link rel="manifest" href="/orgn-site.webmanifest" />
      <Meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
    </>
  )
}
