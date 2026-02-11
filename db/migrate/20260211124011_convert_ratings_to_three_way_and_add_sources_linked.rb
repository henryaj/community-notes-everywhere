class ConvertRatingsToThreeWayAndAddSourcesLinked < ActiveRecord::Migration[8.1]
  def up
    # Convert ratings.helpful boolean to ratings.helpfulness integer enum
    # yes: 0, somewhat: 1, no: 2
    add_column :ratings, :helpfulness, :integer

    # Migrate existing data: true -> 0 (yes), false -> 2 (no)
    execute <<-SQL
      UPDATE ratings SET helpfulness = CASE WHEN helpful = true THEN 0 ELSE 2 END
    SQL

    change_column_null :ratings, :helpfulness, false
    remove_column :ratings, :helpful

    # Add somewhat_count to notes
    add_column :notes, :somewhat_count, :integer, default: 0, null: false

    # Add sources_linked to notes (nullable, default nil)
    add_column :notes, :sources_linked, :boolean, default: nil
  end

  def down
    add_column :ratings, :helpful, :boolean

    execute <<-SQL
      UPDATE ratings SET helpful = CASE WHEN helpfulness = 0 THEN true ELSE false END
    SQL

    change_column_null :ratings, :helpful, false
    remove_column :ratings, :helpfulness

    remove_column :notes, :somewhat_count
    remove_column :notes, :sources_linked
  end
end
