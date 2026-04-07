use backend::{db, routes};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Initialising database...");
    let pool = db::init_db().await?;

    println!("Starting server on 0.0.0.0:8080");
    warp::serve(routes::all_routes(pool))
        .run(([0, 0, 0, 0], 8080))
        .await;

    Ok(())
}
